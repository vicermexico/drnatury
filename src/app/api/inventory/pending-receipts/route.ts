import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";

// GET â€” envÃ­os pendientes de recibir en la sucursal de la terapeuta
export async function GET(_req: NextRequest) {
  const { error, userId } = await guardRole("TERAPEUTA");
  if (error) return error;

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles").select("branch_id").eq("id", userId!).single();

  if (!profile?.branch_id) {
    return NextResponse.json({ error: "NO_BRANCH" }, { status: 400 });
  }

  const { data, error: dbErr } = await admin
    .from("inventory_movements")
    .select(`
      id, quantity_before, quantity_after, notes, performed_at,
      products(id, name, image_url),
      sender:profiles!performed_by(name)
    `)
    .eq("type", "SURTIDO_ALMACEN")
    .eq("branch_id", profile.branch_id)
    .is("received_at", null)
    .order("performed_at", { ascending: false });

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST â€” confirmar la recepciÃ³n de un envÃ­o
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`receipts:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error, userId } = await guardRole("TERAPEUTA");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as { movement_id?: string };
  if (!body.movement_id) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "movement_id es obligatorio" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verificar que el envÃ­o pertenece a la sucursal de la terapeuta y estÃ¡ pendiente
  const { data: profile } = await admin
    .from("profiles").select("branch_id").eq("id", userId!).single();

  if (!profile?.branch_id) {
    return NextResponse.json({ error: "NO_BRANCH" }, { status: 400 });
  }

  const { data: shipment } = await admin
    .from("inventory_movements")
    .select("id, product_id, quantity_before, quantity_after, branch_id, received_at")
    .eq("id", body.movement_id)
    .eq("type", "SURTIDO_ALMACEN")
    .eq("branch_id", profile.branch_id)
    .is("received_at", null)
    .maybeSingle();

  if (!shipment) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "EnvÃ­o no encontrado o ya recibido" },
      { status: 404 }
    );
  }

  // Cantidad recibida = lo que saliÃ³ del almacÃ©n (delta negativo â†’ valor absoluto)
  const qty = shipment.quantity_before - shipment.quantity_after;

  // v3: aumenta stock de la sucursal (p_is_warehouse = false, p_location_branch = branch_id)
  const { data: rpcResult, error: rpcErr } = await admin.rpc("run_inventory", {
    p_product_id:      shipment.product_id,
    p_type:            "RECIBO_SUCURSAL",
    p_delta:           qty,
    p_performed_by:    userId!,
    p_notes:           `Recibo de envÃ­o del almacÃ©n`,
    p_dest_branch_id:  null,
    p_is_warehouse:    false,
    p_location_branch: profile.branch_id,
    p_patient_phone:   null,
  });

  if (rpcErr) {
    return NextResponse.json({ error: "DB_ERROR", message: rpcErr.message }, { status: 500 });
  }

  const res = rpcResult as { error?: string };
  if (res.error) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  // Marcar el envÃ­o original como recibido
  await admin
    .from("inventory_movements")
    .update({ received_at: new Date().toISOString() })
    .eq("id", body.movement_id);

  return NextResponse.json({ received: true, quantity: qty }, { status: 201 });
}


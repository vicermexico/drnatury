import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAnyRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";

// Movimientos del almacenista â€” stock de almacÃ©n central (is_warehouse = true)
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`inventory:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error, userId } = await guardAnyRole("MASTER", "ALMACENISTA");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const { product_id, type, delta, notes, branch_id } = body;

  if (!product_id || !type || delta === undefined) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "product_id, type y delta son obligatorios" },
      { status: 400 }
    );
  }

  const VALID = ["ENTRADA_PROVEEDOR", "SURTIDO_ALMACEN"];
  if (!VALID.includes(String(type))) {
    return NextResponse.json(
      { error: "INVALID_TYPE", message: "Tipo no vÃ¡lido para almacenista" },
      { status: 400 }
    );
  }

  const numDelta = Number(delta);
  if (isNaN(numDelta) || numDelta === 0) {
    return NextResponse.json({ error: "INVALID_DELTA", message: "La cantidad debe ser distinta de cero" }, { status: 400 });
  }

  if (type === "SURTIDO_ALMACEN" && !branch_id) {
    return NextResponse.json(
      { error: "MISSING_BRANCH", message: "Las salidas a sucursal requieren especificar la sucursal destino" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // v3: modifica stock de almacÃ©n central (p_is_warehouse = true)
  const { data: result, error: rpcErr } = await admin.rpc("run_inventory", {
    p_product_id:      String(product_id),
    p_type:            String(type),
    p_delta:           numDelta,
    p_performed_by:    userId!,
    p_notes:           typeof notes === "string" && notes.trim() ? notes.trim() : null,
    p_dest_branch_id:  typeof branch_id === "string" ? branch_id : null,
    p_is_warehouse:    true,
    p_location_branch: null,
    p_patient_phone:   null,
  });

  if (rpcErr) return NextResponse.json({ error: "DB_ERROR", message: rpcErr.message }, { status: 500 });

  const res = result as { error?: string; available?: number };
  if (res.error === "PRODUCT_NOT_FOUND") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (res.error === "INSUFFICIENT_STOCK") {
    return NextResponse.json(
      { error: "INSUFFICIENT_STOCK", message: `Stock insuficiente en almacÃ©n. Disponible: ${res.available}` },
      { status: 409 }
    );
  }

  return NextResponse.json(res, { status: 201 });
}


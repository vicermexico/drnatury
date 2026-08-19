import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`branch-inventory:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  const { error, userId } = await guardRole("TERAPEUTA");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const { product_id, delta, notes, patient_phone } = body;

  if (!product_id || delta === undefined) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "product_id y delta son obligatorios" }, { status: 400 });
  }

  const numDelta = Number(delta);
  if (isNaN(numDelta) || numDelta >= 0) {
    return NextResponse.json({ error: "INVALID_DELTA", message: "Las salidas deben tener delta negativo" }, { status: 400 });
  }

  const phone = typeof patient_phone === "string" ? patient_phone.replace(/\D/g, "") : "";
  if (phone.length < 8) {
    return NextResponse.json(
      { error: "MISSING_PATIENT", message: "El numero de celular del paciente es obligatorio" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Obtener sucursal de la terapeuta
  const { data: profile } = await admin
    .from("profiles").select("branch_id").eq("id", userId!).single();
  if (!profile?.branch_id) {
    return NextResponse.json({ error: "NO_BRANCH", message: "No tienes sucursal asignada" }, { status: 400 });
  }

  // Buscar paciente - primero con numero completo, luego con ultimos 10 digitos
  let patient: { name: string } | null = null;
  const { data: p1 } = await admin
    .from("profiles")
    .select("name")
    .eq("phone", phone)
    .contains("roles", ["PACIENTE"])
    .is("deleted_at", null)
    .maybeSingle();
  patient = p1;

  if (!patient && phone.length > 10) {
    const phoneShort = phone.slice(-10);
    const { data: p2 } = await admin
      .from("profiles")
      .select("name")
      .eq("phone", phoneShort)
      .contains("roles", ["PACIENTE"])
      .is("deleted_at", null)
      .maybeSingle();
    patient = p2;
  }

  const patientInfo = patient?.name ? `Paciente: ${patient.name} (${phone})` : `Paciente: ${phone}`;
  const fullNotes = [patientInfo, typeof notes === "string" && notes.trim() ? notes.trim() : null]
    .filter(Boolean).join(" - ");

  const { data: result, error: rpcErr } = await admin.rpc("run_inventory", {
    p_product_id:      String(product_id),
    p_type:            "VENTA",
    p_delta:           numDelta,
    p_performed_by:    userId!,
    p_notes:           fullNotes,
    p_dest_branch_id:  null,
    p_is_warehouse:    false,
    p_location_branch: profile.branch_id,
    p_patient_phone:   phone,
  });

  if (rpcErr) return NextResponse.json({ error: "DB_ERROR", message: rpcErr.message }, { status: 500 });

  const res = result as { error?: string; available?: number };
  if (res.error === "PRODUCT_NOT_FOUND") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (res.error === "INSUFFICIENT_STOCK") {
    return NextResponse.json(
      { error: "INSUFFICIENT_STOCK", message: `Stock insuficiente en tu sucursal. Disponible: ${res.available}` },
      { status: 409 }
    );
  }

  return NextResponse.json({ ...res, patient_name: patient?.name ?? null }, { status: 201 });
}
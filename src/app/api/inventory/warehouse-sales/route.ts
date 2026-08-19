import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`warehouse-sales:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error, userId } = await guardRole("ALMACENISTA");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const { product_id, delta, patient_phone, notes } = body;

  if (!product_id || delta === undefined || !patient_phone) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "product_id, delta y patient_phone son obligatorios" },
      { status: 400 }
    );
  }

  const numDelta = Number(delta);
  if (isNaN(numDelta) || numDelta >= 0) {
    return NextResponse.json(
      { error: "INVALID_DELTA", message: "Las ventas deben tener delta negativo" },
      { status: 400 }
    );
  }

  const phone = String(patient_phone).replace(/\D/g, "");

  // Buscar nombre del paciente
  const admin = createAdminClient();
  const { data: patient } = await admin
    .from("profiles")
    .select("name")
    .eq("phone", phone)
    .contains("roles", ["PACIENTE"])
    .is("deleted_at", null)
    .maybeSingle();

  const patientInfo = patient?.name ? `Cliente: ${patient.name} (${phone})` : `Cliente: ${phone}`;
  const fullNotes = [patientInfo, typeof notes === "string" && notes.trim() ? notes.trim() : null]
    .filter(Boolean).join(" - ");

  const { data: result, error: rpcErr } = await admin.rpc("run_inventory", {
    p_product_id:      String(product_id),
    p_type:            "VENTA",
    p_delta:           numDelta,
    p_performed_by:    userId!,
    p_notes:           fullNotes,
    p_dest_branch_id:  null,
    p_is_warehouse:    true,
    p_location_branch: null,
    p_patient_phone:   phone,
  });

  if (rpcErr) return NextResponse.json({ error: "DB_ERROR", message: rpcErr.message }, { status: 500 });

  const res = result as { error?: string; available?: number };
  if (res.error === "PRODUCT_NOT_FOUND") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (res.error === "INSUFFICIENT_STOCK") {
    return NextResponse.json(
      { error: "INSUFFICIENT_STOCK", message: `Stock insuficiente. Disponible: ${res.available}` },
      { status: 409 }
    );
  }

  return NextResponse.json(res, { status: 201 });
}

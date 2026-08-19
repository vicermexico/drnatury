import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAnyRole } from "@/lib/auth/api-guard";

export async function POST(request: NextRequest) {
  const { error, userId } = await guardAnyRole("TERAPEUTA", "ASISTENTE", "MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as { patient_id?: string };
  if (!body.patient_id) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Obtener configuracion
  const { data: config } = await admin
    .from("agua_energetica_config")
    .select("dias_activacion, comision_monto")
    .single();

  if (!config) {
    return NextResponse.json({ error: "NO_CONFIG" }, { status: 500 });
  }

  const fechaInicio = new Date();
  const fechaFin = new Date(fechaInicio.getTime() + config.dias_activacion * 24 * 60 * 60 * 1000);

  const { data, error: dbErr } = await admin
    .from("agua_energetica_activaciones")
    .insert({
      patient_id:     body.patient_id,
      activated_by:   userId!,
      fecha_inicio:   fechaInicio.toISOString(),
      fecha_fin:      fechaFin.toISOString(),
      comision_monto: config.comision_monto,
    })
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patient_id");

  const admin = createAdminClient();
  const now = new Date().toISOString();

  let query = admin
    .from("agua_energetica_activaciones")
    .select("id, patient_id, fecha_inicio, fecha_fin, activated_by, profiles!activated_by(name)")
    .gte("fecha_fin", now)
    .order("fecha_fin", { ascending: false });

  if (patientId) {
    query = query.eq("patient_id", patientId);
  }

  const { data } = await query;
  return NextResponse.json(data ?? []);
}

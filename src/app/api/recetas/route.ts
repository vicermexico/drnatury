import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

interface PadecimientoSeleccionado {
  id: string;
  nombre: string;
  recomendaciones_marcadas: string[];
}

export async function POST(request: NextRequest) {
  const { error, userId } = await guardRole("TERAPEUTA");
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as {
    patient_name?: string;
    patient_phone?: string;
    fecha_nacimiento?: string | null;
    estatura_cm?: number | null;
    peso_kg?: number | null;
    padecimientos?: PadecimientoSeleccionado[];
    productos_necesarios?: string | null;
    observaciones?: string | null;
  };

  const patientName = body.patient_name?.trim();
  const patientPhone = body.patient_phone?.trim();
  if (!patientName || !patientPhone) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("recetas")
    .insert({
      therapist_id: userId,
      patient_name: patientName,
      patient_phone: patientPhone,
      fecha_nacimiento: body.fecha_nacimiento || null,
      estatura_cm: body.estatura_cm ?? null,
      peso_kg: body.peso_kg ?? null,
      padecimientos: body.padecimientos ?? [],
      productos_necesarios: body.productos_necesarios?.trim() || null,
      observaciones: body.observaciones?.trim() || null,
    })
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json(data);
}

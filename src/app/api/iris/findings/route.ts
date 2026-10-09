import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAnyRole } from "@/lib/auth/api-guard";

// Lista los hallazgos (comparaciones de IA) ya generados para las fotos
// de un paciente. Master y Terapeuta — nunca el paciente.
export async function GET(request: NextRequest) {
  const { error } = await guardAnyRole("MASTER", "TERAPEUTA");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patient_id");
  if (!patientId) return NextResponse.json({ error: "MISSING_PATIENT_ID" }, { status: 400 });

  const admin = createAdminClient();

  const { data: photos } = await admin
    .from("iris_patient_photos")
    .select("id")
    .eq("patient_id", patientId)
    .is("deleted_at", null);

  const photoIds = (photos ?? []).map((p) => p.id);
  if (photoIds.length === 0) return NextResponse.json([]);

  const { data, error: dbErr } = await admin
    .from("iris_findings")
    .select("id, patient_photo_id, summary, matches, disclaimer, created_at")
    .in("patient_photo_id", photoIds)
    .order("created_at", { ascending: false });

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

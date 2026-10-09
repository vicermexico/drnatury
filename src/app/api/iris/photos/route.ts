import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAnyRole, guardRole } from "@/lib/auth/api-guard";

// La foto ya se subio directo desde el navegador al bucket privado
// "iris-photos" (terapeuta/asistente/master pueden subir). Aqui solo se
// guarda el registro. Nadie puede listar estas fotos salvo Master
// (GET esta restringido a MASTER — ver /master/pacientes/[id]).

export async function POST(request: NextRequest) {
  const { error, userId } = await guardAnyRole("MASTER", "TERAPEUTA", "ASISTENTE");
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as {
    patient_id?: string;
    eye?: string;
    image_path?: string;
  };
  const { patient_id, eye, image_path } = body;

  if (!patient_id || !image_path || (eye !== "IZQUIERDO" && eye !== "DERECHO")) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("iris_patient_photos")
    .insert({ patient_id, eye, image_path, uploaded_by: userId })
    .select("id, patient_id, eye, image_path, created_at")
    .single();

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patient_id");
  if (!patientId) return NextResponse.json({ error: "MISSING_PATIENT_ID" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("iris_patient_photos")
    .select("id, patient_id, eye, image_path, created_at")
    .eq("patient_id", patientId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  const withUrls = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: signed } = await admin.storage
        .from("iris-photos")
        .createSignedUrl(row.image_path, 3600);
      return { ...row, image_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json(withUrls);
}

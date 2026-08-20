import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerProfile } from "@/lib/auth";

// Antes: este endpoint recibia el archivo completo (formData) y el propio
// servidor de Vercel lo subia a Supabase. Los archivos grandes (sobre todo
// videos) son mas grandes que el limite de 4.5MB que Vercel le pone al
// cuerpo de una funcion, asi que la subida fallaba con "Error al guardar".
//
// Ahora: el navegador primero pide aqui un "permiso de subida" (solo
// texto, no el archivo), y luego sube el archivo DIRECTO a Supabase
// Storage desde el navegador, sin pasar por Vercel.
export async function POST(req: NextRequest) {
  const profile = await getServerProfile();
  if (!profile) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    filename?: string;
  };
  if (!body.filename) {
    return NextResponse.json({ message: "Falta el nombre del archivo" }, { status: 400 });
  }

  const safeName = body.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${Date.now()}-${safeName}`;
  const admin = createAdminClient();

  const { data, error } = await admin.storage
    .from("landing")
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    return NextResponse.json({ message: error?.message ?? "Error al preparar la subida" }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from("landing").getPublicUrl(path);

  return NextResponse.json({
    path: data.path,
    token: data.token,
    publicUrl: urlData.publicUrl,
  });
}

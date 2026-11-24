import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

// Igual patron que /api/landing/upload: el navegador pide aqui un
// "permiso de subida" (sin mandar el archivo) y luego sube la foto
// DIRECTO al bucket de Storage "products", sin pasar por Vercel (los
// archivos grandes truenan el limite de 4.5MB del cuerpo de una
// funcion si se suben por aqui).
export async function POST(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as {
    productoId?: string;
    filename?: string;
  };
  if (!body.productoId || !body.filename) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta el producto o el archivo" }, { status: 400 });
  }

  const safeName = body.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${body.productoId}/${Date.now()}-${safeName}`;
  const admin = createAdminClient();

  const { data, error: signError } = await admin.storage
    .from("products")
    .createSignedUploadUrl(path, { upsert: true });

  if (signError || !data) {
    return NextResponse.json({ error: "SIGN_ERROR", message: signError?.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from("products").getPublicUrl(path);

  return NextResponse.json({
    path: data.path,
    token: data.token,
    publicUrl: urlData.publicUrl,
  });
}

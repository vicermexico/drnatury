import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";

// Paso 1 para subir el audio de orientacion de un lugar (ej. "para
// llegar a San Blas, de tal calle se mete..."): el navegador pide aqui
// un "permiso de subida" y luego sube el archivo DIRECTO a Supabase
// Storage, sin pasar por Vercel. Mismo patron y mismo bucket que
// /api/master/bot-demo/bienvenida/upload, nada mas con su propia
// carpeta (ubicaciones/) para no mezclarse con los audios de
// bienvenida.
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-ubicaciones-audio-upload:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as { filename?: string };
  if (!body.filename) {
    return NextResponse.json({ message: "Falta el nombre del archivo" }, { status: 400 });
  }

  const safeName = body.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `ubicaciones/${Date.now()}-${safeName}`;
  const admin = createAdminClient();

  const { data, error: uploadErr } = await admin.storage
    .from("whatsapp-bot-bienvenida")
    .createSignedUploadUrl(path, { upsert: true });

  if (uploadErr || !data) {
    return NextResponse.json({ message: uploadErr?.message ?? "Error al preparar la subida" }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from("whatsapp-bot-bienvenida").getPublicUrl(path);

  return NextResponse.json({
    path: data.path,
    token: data.token,
    publicUrl: urlData.publicUrl,
  });
}

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

const validTipos = ["video_espera", "imagen_activa", "video_sesion"];

// Antes: este endpoint recibia el archivo completo (formData) y el propio
// servidor de Vercel lo subia a Supabase. Los videos son mas grandes que
// el limite de 4.5MB que Vercel le pone al cuerpo de una funcion, asi que
// las subidas de video fallaban en silencio (subia y al regresar ya no
// estaba).
//
// Ahora: el navegador primero pide aqui un "permiso de subida" (sin
// mandar el archivo, solo texto), y luego el navegador sube el archivo
// DIRECTO a Supabase Storage, sin pasar por Vercel. Aqui solo se genera
// ese permiso.
export async function POST(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as {
    tipo?: string;
    ext?: string;
  };
  const { tipo, ext } = body;
  if (!tipo || !ext) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }
  if (!validTipos.includes(tipo)) {
    return NextResponse.json({ error: "INVALID_TIPO" }, { status: 400 });
  }

  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "") || "bin";
  const fileName = `${tipo}.${safeExt}`;
  const admin = createAdminClient();

  const { data, error: signError } = await admin.storage
    .from("agua-energetica")
    .createSignedUploadUrl(fileName, { upsert: true });

  if (signError || !data) {
    return NextResponse.json(
      { error: "SIGN_ERROR", message: signError?.message },
      { status: 500 }
    );
  }

  const { data: urlData } = admin.storage
    .from("agua-energetica")
    .getPublicUrl(fileName);

  return NextResponse.json({
    path: data.path,
    token: data.token,
    publicUrl: urlData.publicUrl,
  });
}

// Se llama despues de que el navegador ya subio el archivo directo a
// Supabase, para guardar la URL final en la configuracion.
export async function PATCH(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as {
    tipo?: string;
    url?: string;
  };
  const { tipo, url } = body;
  if (!tipo || !url || !validTipos.includes(tipo)) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: config } = await admin
    .from("agua_energetica_config")
    .select("id")
    .single();

  if (config) {
    await admin
      .from("agua_energetica_config")
      .update({ [`${tipo}_url`]: url, updated_at: new Date().toISOString() })
      .eq("id", config.id);
  }

  return NextResponse.json({ ok: true });
}

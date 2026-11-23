import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";

// Administra la serie de mensajes de bienvenida (texto y/o audio, en el
// orden que Master decida) que el Asistente de WhatsApp manda cuando
// alguien le escribe por primera vez despues de darle clic a un
// anuncio. Ver src/lib/whatsapp-bot/bienvenida.ts para como se lee.
export async function GET() {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("whatsapp_bot_bienvenida")
    .select("id, orden, tipo, texto, audio_url, video_url")
    .order("orden", { ascending: true });

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ mensajes: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-bienvenida:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as {
    tipo?: "texto" | "audio" | "video";
    texto?: string;
    audio_url?: string;
    video_url?: string;
  };

  const admin = createAdminClient();

  if (body.tipo === "texto") {
    const texto = (body.texto ?? "").trim();
    if (!texto) {
      return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta el texto" }, { status: 400 });
    }
    const { data: maxRow } = await admin
      .from("whatsapp_bot_bienvenida")
      .select("orden")
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const siguienteOrden = ((maxRow?.orden as number | undefined) ?? 0) + 1;

    const { error: dbErr } = await admin
      .from("whatsapp_bot_bienvenida")
      .insert({ orden: siguienteOrden, tipo: "texto", texto });

    if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.tipo === "audio") {
    const audioUrl = (body.audio_url ?? "").trim();
    if (!audioUrl) {
      return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta el audio" }, { status: 400 });
    }
    const { data: maxRow } = await admin
      .from("whatsapp_bot_bienvenida")
      .select("orden")
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const siguienteOrden = ((maxRow?.orden as number | undefined) ?? 0) + 1;

    const { error: dbErr } = await admin
      .from("whatsapp_bot_bienvenida")
      .insert({ orden: siguienteOrden, tipo: "audio", audio_url: audioUrl });

    if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.tipo === "video") {
    const videoUrl = (body.video_url ?? "").trim();
    if (!videoUrl) {
      return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta el video" }, { status: 400 });
    }
    const { data: maxRow } = await admin
      .from("whatsapp_bot_bienvenida")
      .select("orden")
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const siguienteOrden = ((maxRow?.orden as number | undefined) ?? 0) + 1;

    const { error: dbErr } = await admin
      .from("whatsapp_bot_bienvenida")
      .insert({ orden: siguienteOrden, tipo: "video", video_url: videoUrl });

    if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta el tipo (texto, audio o video)" }, { status: 400 });
}

// Editar el texto de un mensaje ya existente (para corregir sin tener
// que borrarlo y volver a crearlo, lo cual le cambiaria de lugar).
export async function PATCH(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-bienvenida-editar:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    texto?: string;
    ids_en_orden?: string[];
  };

  const admin = createAdminClient();

  // Reordenar: llega la lista completa de ids en el nuevo orden deseado.
  if (Array.isArray(body.ids_en_orden) && body.ids_en_orden.length > 0) {
    for (let i = 0; i < body.ids_en_orden.length; i++) {
      const { error: dbErr } = await admin
        .from("whatsapp_bot_bienvenida")
        .update({ orden: i + 1, updated_at: new Date().toISOString() })
        .eq("id", body.ids_en_orden[i]);
      if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Editar el texto de un mensaje.
  const id = (body.id ?? "").trim();
  const texto = (body.texto ?? "").trim();
  if (!id || !texto) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }
  const { error: dbErr } = await admin
    .from("whatsapp_bot_bienvenida")
    .update({ texto, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tipo", "texto");

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-bienvenida-borrar:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const id = (body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: fila } = await admin
    .from("whatsapp_bot_bienvenida")
    .select("tipo, audio_url, video_url")
    .eq("id", id)
    .maybeSingle();

  const { error: dbErr } = await admin.from("whatsapp_bot_bienvenida").delete().eq("id", id);
  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  // Si el audio o video que se borro vive en nuestro propio storage,
  // tambien se borra el archivo para no dejar basura -- pero esto es
  // "mejor esfuerzo": el renglon de la base de datos YA se borro arriba,
  // asi que si tronara este paso (ej. el archivo ya no existe, o algun
  // error de storage) no se le debe avisar al usuario que "no se pudo
  // borrar" cuando en realidad el mensaje si desaparecio.
  try {
    const marcaStorage = "/storage/v1/object/public/whatsapp-bot-bienvenida/";
    for (const url of [fila?.audio_url, fila?.video_url] as (string | undefined)[]) {
      if (url && url.includes(marcaStorage)) {
        const path = url.split(marcaStorage)[1];
        if (path) {
          await admin.storage.from("whatsapp-bot-bienvenida").remove([path]);
        }
      }
    }
  } catch (err) {
    console.error("No se pudo borrar el archivo de storage (el mensaje si se borro):", err);
  }

  return NextResponse.json({ ok: true });
}

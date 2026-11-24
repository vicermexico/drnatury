import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizar } from "@/lib/whatsapp-bot/engine";
import { obtenerBotIdPorSlug } from "@/lib/whatsapp-bot/bots";

// Administra las ubicaciones que Master guarda -- ver
// /master/asistente-whatsapp/ubicaciones. Esta pantalla es
// independiente de donde la plataforma administra las sucursales: el
// Asistente de WhatsApp manda lo que Master escribio/guardo AQUI (la
// direccion de texto, el GPS exacto parado en el lugar, o los dos)
// cuando un paciente pide "la ubicación"/"la dirección" de algún lugar.
//
// Desde la Fase 1 del bot de venta de productos, cada bot (ver
// src/lib/whatsapp-bot/bots.ts) tiene sus propias ubicaciones -- "bot"
// en la query string (GET) o el body (POST) dice de cual.
export async function GET(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const admin = createAdminClient();
  const botId = await obtenerBotIdPorSlug(admin, request.nextUrl.searchParams.get("bot") ?? "consultas");
  if (!botId) return NextResponse.json({ error: "BOT_NO_ENCONTRADO" }, { status: 400 });

  const { data, error: dbErr } = await admin
    .from("whatsapp_bot_ubicaciones")
    .select("id, nombre, direccion, lat, lng, audio_url, updated_at")
    .eq("bot_id", botId)
    .order("nombre");

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ubicaciones: data ?? [] });
}

// Guarda (o actualiza, si ya existia una con el mismo nombre) la
// direccion y/o el GPS de un lugar -- se puede llamar con solo la
// direccion escrita a mano, solo con el GPS (capturado parado ahi
// mismo, ver UbicacionesManager.tsx), o con los dos. Si ya existia esa
// ubicacion y esta vez solo se manda uno de los dos datos, se
// conserva el otro que ya tenia en vez de borrarlo.
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-ubicaciones:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as {
    nombre?: string;
    direccion?: string;
    lat?: number;
    lng?: number;
    audio_url?: string;
    bot?: string;
  };
  const nombre = (body.nombre ?? "").trim();
  const direccion = (body.direccion ?? "").trim();
  const lat = typeof body.lat === "number" ? body.lat : null;
  const lng = typeof body.lng === "number" ? body.lng : null;
  const audioUrl = (body.audio_url ?? "").trim();
  if (!nombre || (!direccion && (lat === null || lng === null) && !audioUrl)) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "Falta el nombre, y la dirección o la ubicación por GPS" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const botId = await obtenerBotIdPorSlug(admin, body.bot ?? "consultas");
  if (!botId) return NextResponse.json({ error: "BOT_NO_ENCONTRADO" }, { status: 400 });

  const nombreNormalizado = normalizar(nombre);
  const { data: existente } = await admin
    .from("whatsapp_bot_ubicaciones")
    .select("direccion, lat, lng, audio_url")
    .eq("nombre_normalizado", nombreNormalizado)
    .eq("bot_id", botId)
    .maybeSingle();

  const { error: dbErr } = await admin
    .from("whatsapp_bot_ubicaciones")
    .upsert(
      {
        bot_id: botId,
        nombre,
        nombre_normalizado: nombreNormalizado,
        direccion: direccion || existente?.direccion || null,
        lat: lat ?? existente?.lat ?? null,
        lng: lng ?? existente?.lng ?? null,
        audio_url: audioUrl || existente?.audio_url || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "bot_id,nombre_normalizado" }
    );

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-ubicaciones-borrar:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as { id?: string };
  const id = (body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: dbErr } = await admin.from("whatsapp_bot_ubicaciones").delete().eq("id", id);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

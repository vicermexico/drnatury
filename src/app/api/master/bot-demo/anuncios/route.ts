import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizarEscritoAnuncio } from "@/lib/whatsapp-bot/engine";
import { obtenerBotIdPorSlug } from "@/lib/whatsapp-bot/bots";

// Administra los "escritos" (textos pre-llenados de los anuncios de
// Facebook/Instagram de Vic) que el Asistente de WhatsApp usa para
// saber si un primer mensaje de verdad viene de hacer clic en un
// anuncio, o si es otra cosa (ej. un mensaje de seguimiento) que no
// debe recibir el saludo automatico.
//
// Desde la Fase 1 del bot de venta de productos, cada bot (ver
// src/lib/whatsapp-bot/bots.ts) tiene sus propios escritos -- "bot" en
// la query string (GET) o el body (POST) dice de cual.
export async function GET(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const admin = createAdminClient();
  const botId = await obtenerBotIdPorSlug(admin, request.nextUrl.searchParams.get("bot") ?? "consultas");
  if (!botId) return NextResponse.json({ error: "BOT_NO_ENCONTRADO" }, { status: 400 });

  const { data, error: dbErr } = await admin
    .from("whatsapp_bot_anuncios")
    .select("id, texto, created_at")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ anuncios: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-anuncios:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as { texto?: string; bot?: string };
  const texto = (body.texto ?? "").trim();
  if (!texto) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta el texto del anuncio" }, { status: 400 });
  }

  const textoNormalizado = normalizarEscritoAnuncio(texto);
  if (!textoNormalizado) {
    return NextResponse.json({ error: "INVALID_TEXT", message: "El texto quedo vacio despues de quitarle el codigo" }, { status: 400 });
  }

  const admin = createAdminClient();
  const botId = await obtenerBotIdPorSlug(admin, body.bot ?? "consultas");
  if (!botId) return NextResponse.json({ error: "BOT_NO_ENCONTRADO" }, { status: 400 });

  const { error: dbErr } = await admin
    .from("whatsapp_bot_anuncios")
    .upsert({ bot_id: botId, texto, texto_normalizado: textoNormalizado }, { onConflict: "bot_id,texto_normalizado" });

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-anuncios-borrar:${ip}`, 60, 60_000)) {
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
  const { error: dbErr } = await admin.from("whatsapp_bot_anuncios").delete().eq("id", id);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizarEscritoAnuncio } from "@/lib/whatsapp-bot/engine";

// Administra los "escritos" (textos pre-llenados de los anuncios de
// Facebook/Instagram de Vic) que el Asistente de WhatsApp usa para
// saber si un primer mensaje de verdad viene de hacer clic en un
// anuncio, o si es otra cosa (ej. un mensaje de seguimiento) que no
// debe recibir el saludo automatico.
export async function GET() {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("whatsapp_bot_anuncios")
    .select("id, texto, created_at")
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

  const body = await request.json().catch(() => ({})) as { texto?: string };
  const texto = (body.texto ?? "").trim();
  if (!texto) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta el texto del anuncio" }, { status: 400 });
  }

  const textoNormalizado = normalizarEscritoAnuncio(texto);
  if (!textoNormalizado) {
    return NextResponse.json({ error: "INVALID_TEXT", message: "El texto quedo vacio despues de quitarle el codigo" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: dbErr } = await admin
    .from("whatsapp_bot_anuncios")
    .upsert({ texto, texto_normalizado: textoNormalizado }, { onConflict: "texto_normalizado" });

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

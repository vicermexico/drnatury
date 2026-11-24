import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { esBotSlugValido } from "@/lib/whatsapp-bot/bots";

// Edita el perfil del chat publico de un bot (nombre, foto y link del
// anuncio de Facebook que ve el paciente -- ver ChatPerfilEditor.tsx).
// Desde la Fase 1 del bot de venta de productos cada bot (ver
// src/lib/whatsapp-bot/bots.ts) trae su propio perfil, guardado en la
// tabla whatsapp_bots (antes vivian juntos, compartidos, en
// landing_config -- eso se queda igual para los demas campos de esa
// tabla, que no son del Asistente de WhatsApp).
export async function PATCH(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-perfil:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as {
    bot?: string;
    chat_perfil_nombre?: string;
    chat_perfil_foto?: string | null;
    anuncio_facebook_url?: string | null;
  };
  const slug = body.bot ?? "consultas";
  if (!esBotSlugValido(slug)) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const patch: Record<string, string | null> = {};
  if (body.chat_perfil_nombre !== undefined) patch.chat_perfil_nombre = body.chat_perfil_nombre;
  if (body.chat_perfil_foto !== undefined) patch.chat_perfil_foto = body.chat_perfil_foto;
  if (body.anuncio_facebook_url !== undefined) patch.anuncio_facebook_url = body.anuncio_facebook_url;

  const admin = createAdminClient();
  const { error: dbErr } = await admin.from("whatsapp_bots").update(patch).eq("slug", slug);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

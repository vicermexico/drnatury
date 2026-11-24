import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { esBotSlugValido } from "@/lib/whatsapp-bot/bots";

// Lista los bots del Asistente de WhatsApp (ver tabla whatsapp_bots y
// src/lib/whatsapp-bot/bots.ts) -- por ahora "consultas" y "pomada" --
// para los botones selectores en /master/asistente-whatsapp. El slug de
// cada uno es fijo en el codigo, pero el nombre que se ve en el boton
// si se puede editar (ver PATCH).
export async function GET() {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("whatsapp_bots")
    .select("slug, nombre")
    .order("slug");

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ bots: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-bots:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as { slug?: string; nombre?: string };
  const slug = (body.slug ?? "").trim();
  const nombre = (body.nombre ?? "").trim();
  if (!esBotSlugValido(slug) || !nombre) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: dbErr } = await admin.from("whatsapp_bots").update({ nombre }).eq("slug", slug);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

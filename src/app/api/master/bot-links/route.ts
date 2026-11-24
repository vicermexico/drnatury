import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { esBotSlugValido, obtenerBotIdPorSlug, BOT_LINK_PUBLICO } from "@/lib/whatsapp-bot/bots";

// Deja el texto que Master escribio listo para ir en una URL: minusculas,
// sin acentos, espacios cambiados por guiones, y solo letras/numeros/
// guiones -- para que el link se vea limpio y no truene en ningun
// navegador (ej. "Promo Navidad!!" -> "promo-navidad").
function normalizarCodigo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// GET: lista los links que Master ya genero para este bot, con cuantos
// leads (conversaciones) trajo cada uno hasta ahora (ver
// chat_leads.codigo_anuncio, que es donde se guarda con cual se abrio
// cada conversacion -- ver PublicChatDemo.tsx).
export async function GET(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const bot = request.nextUrl.searchParams.get("bot");
  if (!esBotSlugValido(bot)) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta indicar el bot" }, { status: 400 });
  }

  const admin = createAdminClient();
  const botId = await obtenerBotIdPorSlug(admin, bot);

  const { data: links, error: dbErr } = await admin
    .from("whatsapp_bot_links")
    .select("id, codigo, nota, created_at")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  const linksConConteo = await Promise.all(
    (links ?? []).map(async (link) => {
      const { count } = await admin
        .from("chat_leads")
        .select("id", { count: "exact", head: true })
        .eq("bot_id", botId)
        .eq("codigo_anuncio", link.codigo);
      return {
        id: link.id,
        codigo: link.codigo,
        nota: link.nota,
        createdAt: link.created_at,
        leads: count ?? 0,
        url: `${BOT_LINK_PUBLICO[bot]}?anuncio=${link.codigo}`,
      };
    })
  );

  return NextResponse.json({ links: linksConConteo });
}

// POST: genera un link nuevo (Master escribe el texto, ver
// normalizarCodigo arriba).
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-links:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as { bot?: string; codigo?: string; nota?: string };
  if (!esBotSlugValido(body.bot)) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta indicar el bot" }, { status: 400 });
  }
  const codigo = normalizarCodigo(body.codigo ?? "");
  if (codigo.length < 2) {
    return NextResponse.json(
      { error: "INVALID_CODIGO", message: "Escribe un texto más largo para el link" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const botId = await obtenerBotIdPorSlug(admin, body.bot);

  const { data: existente } = await admin
    .from("whatsapp_bot_links")
    .select("id")
    .eq("bot_id", botId)
    .eq("codigo", codigo)
    .maybeSingle();
  if (existente) {
    return NextResponse.json(
      { error: "ALREADY_EXISTS", message: "Ya existe un link con ese texto para este bot" },
      { status: 409 }
    );
  }

  const { data: link, error: dbErr } = await admin
    .from("whatsapp_bot_links")
    .insert({ bot_id: botId, codigo, nota: body.nota?.trim() || null })
    .select("id, codigo, nota, created_at")
    .single();

  if (dbErr || !link) {
    return NextResponse.json({ error: "DB_ERROR", message: dbErr?.message }, { status: 500 });
  }

  return NextResponse.json({
    id: link.id,
    codigo: link.codigo,
    nota: link.nota,
    createdAt: link.created_at,
    leads: 0,
    url: `${BOT_LINK_PUBLICO[body.bot]}?anuncio=${link.codigo}`,
  }, { status: 201 });
}

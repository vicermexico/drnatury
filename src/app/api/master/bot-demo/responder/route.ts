import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { generarRespuesta, ESTADO_INICIAL, type EstadoAgendado, type Correccion, type Anuncio, type Ubicacion } from "@/lib/whatsapp-bot/engine";
import { generarRespuestaPomada, ESTADO_INICIAL_PEDIDO, type EstadoPedido } from "@/lib/whatsapp-bot/engine-pomada";
import { obtenerSerieBienvenida } from "@/lib/whatsapp-bot/bienvenida";
import { obtenerBotIdPorSlug, esBotSlugValido } from "@/lib/whatsapp-bot/bots";

// Pagina de demo/entrenamiento del asistente de WhatsApp (ver
// /master/asistente-whatsapp): Master escribe como si fuera un paciente,
// este endpoint corre el "cerebro" del bot que corresponda y regresa
// que hubiera contestado. Todavia NO esta conectado a ningun WhatsApp
// real -- es solo para probar y entrenar antes de conectarlo. A
// proposito NUNCA registra nada de verdad (ni citas ni pedidos), aunque
// la conversacion llegue hasta el resumen final -- eso solo pasa en el
// chat publico de verdad (ver /api/public/asistente-whatsapp).
//
// Desde la Fase 1/2 del bot de venta de productos puede haber mas de un
// bot (ver src/lib/whatsapp-bot/bots.ts) -- "bot" en el body dice cual
// de ellos se esta probando: "consultas" usa el cerebro de citas
// (engine.ts) y "pomada" usa el cerebro de ventas de la Pomada Barak
// Flex (engine-pomada.ts).
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as {
    mensaje?: string;
    estado?: EstadoAgendado | EstadoPedido;
    bot?: string;
  };

  const mensaje = (body.mensaje ?? "").trim();
  if (!mensaje) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta el mensaje" }, { status: 400 });
  }

  const admin = createAdminClient();
  const botSlug = esBotSlugValido(body.bot) ? body.bot : "consultas";
  const botId = await obtenerBotIdPorSlug(admin, botSlug);
  if (!botId) {
    return NextResponse.json({ error: "BOT_NO_ENCONTRADO" }, { status: 400 });
  }

  const { data: correccionesRaw } = await admin
    .from("whatsapp_bot_correcciones")
    .select("disparador, respuesta")
    .eq("bot_id", botId);
  const correcciones: Correccion[] = correccionesRaw ?? [];

  const { data: anunciosRaw } = await admin
    .from("whatsapp_bot_anuncios")
    .select("texto_normalizado")
    .eq("bot_id", botId);
  const anuncios: Anuncio[] = (anunciosRaw ?? []).map((a) => ({ textoNormalizado: a.texto_normalizado as string }));
  const bienvenida = await obtenerSerieBienvenida(admin, botId);

  if (botSlug === "pomada") {
    const estado: EstadoPedido = (body.estado as EstadoPedido) ?? ESTADO_INICIAL_PEDIDO;
    const resultado = await generarRespuestaPomada({ mensaje, estado, correcciones, anuncios, bienvenida });
    return NextResponse.json(resultado);
  }

  const { data: ubicacionesRaw } = await admin
    .from("whatsapp_bot_ubicaciones")
    .select("nombre, nombre_normalizado, direccion, lat, lng, audio_url")
    .eq("bot_id", botId);
  const ubicaciones: Ubicacion[] = (ubicacionesRaw ?? []).map((u) => ({
    nombre: u.nombre as string,
    nombreNormalizado: u.nombre_normalizado as string,
    direccion: u.direccion as string | null,
    lat: u.lat as number | null,
    lng: u.lng as number | null,
    audioUrl: u.audio_url as string | null,
  }));

  const estado: EstadoAgendado = (body.estado as EstadoAgendado) ?? ESTADO_INICIAL;
  const resultado = await generarRespuesta({
    mensaje,
    estado,
    correcciones,
    anuncios,
    bienvenida,
    ubicaciones,
    // El bot "consultas" siempre cae de respaldo al saludo generico de
    // DrNatury cuando no hay bienvenida configurada.
    usarBienvenidaGenerica: true,
  });

  return NextResponse.json(resultado);
}

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { generarRespuesta, ESTADO_INICIAL, type EstadoAgendado, type Correccion, type Anuncio } from "@/lib/whatsapp-bot/engine";

// Pagina de demo/entrenamiento del asistente de WhatsApp (ver
// /master/asistente-whatsapp): Master escribe como si fuera un paciente,
// este endpoint corre el "cerebro" del bot (src/lib/whatsapp-bot/engine.ts)
// y regresa que hubiera contestado. Todavia NO esta conectado a ningun
// WhatsApp real -- es solo para probar y entrenar antes de conectarlo.
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as {
    mensaje?: string;
    estado?: EstadoAgendado;
  };

  const mensaje = (body.mensaje ?? "").trim();
  if (!mensaje) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta el mensaje" }, { status: 400 });
  }
  const estado: EstadoAgendado = body.estado ?? ESTADO_INICIAL;

  const admin = createAdminClient();
  const { data: correccionesRaw } = await admin
    .from("whatsapp_bot_correcciones")
    .select("disparador, respuesta");
  const correcciones: Correccion[] = correccionesRaw ?? [];

  const { data: anunciosRaw } = await admin
    .from("whatsapp_bot_anuncios")
    .select("texto_normalizado");
  const anuncios: Anuncio[] = (anunciosRaw ?? []).map((a) => ({ textoNormalizado: a.texto_normalizado as string }));

  const resultado = await generarRespuesta({ mensaje, estado, correcciones, anuncios });

  return NextResponse.json(resultado);
}

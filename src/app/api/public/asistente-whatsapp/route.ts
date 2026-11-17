import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { generarRespuesta, ESTADO_INICIAL, type EstadoAgendado, type Correccion, type Anuncio } from "@/lib/whatsapp-bot/engine";

// Version PUBLICA (sin login) del "cerebro" del bot -- para la pagina
// de demo que Vic manda por link a quien quiera (/demo-whatsapp).
// A proposito NO permite ensenar correcciones ni subir/borrar escritos
// de anuncios -- eso sigue siendo solo para Vic desde /master. Aqui
// solo se lee lo que ya esta guardado (correcciones + anuncios) para
// que conteste igual que en la demo de Master, pero sin poder
// modificar nada.
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-publico:${ip}`, 40, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

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

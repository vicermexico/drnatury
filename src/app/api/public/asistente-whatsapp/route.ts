import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { generarRespuesta, ESTADO_INICIAL, type EstadoAgendado, type Correccion, type Anuncio } from "@/lib/whatsapp-bot/engine";
import { obtenerSerieBienvenida } from "@/lib/whatsapp-bot/bienvenida";
import { crearCitaRapida } from "@/lib/appointments/quickBook";

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
  const bienvenida = await obtenerSerieBienvenida(admin);

  const resultado = await generarRespuesta({ mensaje, estado, correcciones, anuncios, bienvenida, canalPublico: true });

  // Si justo en este turno se termino de agendar (el bot ya dio el
  // resumen final), se registra la cita de verdad en la plataforma --
  // igual que cuando Master agenda rapido desde su link privado
  // (/api/quick/book), pero sin bloquear la respuesta al paciente: si
  // algo sale mal (ej. ese horario ya se ocupo entre que se lo ofrecimos
  // y que confirmo), igual se le manda el resumen y el boton de WhatsApp
  // como siempre, y el error queda en los logs para revisarlo.
  const agendado = resultado.agendado;
  if (agendado?.fechaISO && agendado?.hora24) {
    try {
      const telefonoDigits = agendado.celular.replace(/\D/g, "") || null;
      const resultadoCita = await crearCitaRapida(admin, {
        nombre: agendado.nombre,
        telefonoDigits,
        fechaISO: agendado.fechaISO,
        hora24: agendado.hora24,
        modalidad: agendado.modalidadCodigo,
        lugar: agendado.lugar ?? null,
        numPersonas: agendado.personas,
        costoTotal: agendado.costoTotal,
        notas: `Agendado por chat web: ${agendado.nombre}`,
      });
      if (!resultadoCita.ok) {
        console.error("No se pudo registrar la cita del chat publico en la plataforma:", resultadoCita.error, agendado);
      }
    } catch (err) {
      console.error("Error registrando la cita del chat publico en la plataforma:", err);
    }
  }

  return NextResponse.json(resultado);
}

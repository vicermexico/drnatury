import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { generarRespuesta, ESTADO_INICIAL, type EstadoAgendado, type Correccion, type Anuncio, type Ubicacion } from "@/lib/whatsapp-bot/engine";
import { obtenerSerieBienvenida } from "@/lib/whatsapp-bot/bienvenida";
import { crearCitaRapida } from "@/lib/appointments/quickBook";
import { generateConfirmToken } from "@/lib/appointments/tokens";
import { notificarApoyoConCliente } from "@/lib/push/send";

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
    conversacionId?: string;
    origen?: string;
    codigoAnuncio?: string;
  };

  const mensaje = (body.mensaje ?? "").trim();
  if (!mensaje) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta el mensaje" }, { status: 400 });
  }
  const estado: EstadoAgendado = body.estado ?? ESTADO_INICIAL;

  const admin = createAdminClient();

  // Registro ligero de la conversacion (ver tabla chat_leads y
  // /master/asistente-whatsapp/mensajes): un id por conversacion que el
  // chat genera una sola vez y manda en cada mensaje -- si es la primera
  // vez que se ve ese id, se crea el renglon. No bloquea la respuesta si
  // falla (es solo para las estadisticas de Master).
  const conversacionId = body.conversacionId;
  if (conversacionId) {
    try {
      const { data: existente } = await admin
        .from("chat_leads")
        .select("id")
        .eq("id", conversacionId)
        .maybeSingle();
      if (!existente) {
        await admin.from("chat_leads").insert({
          id: conversacionId,
          origen: body.origen === "inicio" ? "inicio" : "anuncio",
          codigo_anuncio: body.codigoAnuncio?.trim() || null,
        });
      }
      // Se va guardando el texto de cada mensaje del paciente -- solo se
      // queda guardado si la conversacion al final NO se cierra con cita
      // (en cuanto se cierra, se borra mas abajo), para que Master pueda
      // revisar en donde se "rego" el bot en
      // /master/asistente-whatsapp/revision.
      await admin.from("chat_messages").insert({ lead_id: conversacionId, rol: "paciente", texto: mensaje });
      // Cada vez que el visitante escribe se "reactiva" la conversacion:
      // se marca cuando fue el ultimo movimiento (para el CRON de
      // recordatorio, ver /api/cron/recordatorio-chat) y se limpia
      // recordatorio_enviado_at para que, si ya se le habia mandado un
      // recordatorio antes y volvio a escribir, se le pueda volver a
      // mandar si se vuelve a quedar callado.
      await admin
        .from("chat_leads")
        .update({ updated_at: new Date().toISOString(), recordatorio_enviado_at: null })
        .eq("id", conversacionId);
    } catch (err) {
      console.error("Error registrando el chat_lead:", err);
    }
  }
  const { data: correccionesRaw } = await admin
    .from("whatsapp_bot_correcciones")
    .select("disparador, respuesta");
  const correcciones: Correccion[] = correccionesRaw ?? [];

  const { data: anunciosRaw } = await admin
    .from("whatsapp_bot_anuncios")
    .select("texto_normalizado");
  const anuncios: Anuncio[] = (anunciosRaw ?? []).map((a) => ({ textoNormalizado: a.texto_normalizado as string }));
  const bienvenida = await obtenerSerieBienvenida(admin);

  const { data: ubicacionesRaw } = await admin
    .from("whatsapp_bot_ubicaciones")
    .select("nombre, nombre_normalizado, direccion, lat, lng, audio_url");
  const ubicaciones: Ubicacion[] = (ubicacionesRaw ?? []).map((u) => ({
    nombre: u.nombre as string,
    nombreNormalizado: u.nombre_normalizado as string,
    direccion: u.direccion as string | null,
    lat: u.lat as number | null,
    lng: u.lng as number | null,
    audioUrl: u.audio_url as string | null,
  }));

  const resultado = await generarRespuesta({ mensaje, estado, correcciones, anuncios, bienvenida, ubicaciones, canalPublico: true });

  // Si el bot de plano no supo que contestar (ver nota
  // "no_entendido_publico" en engine.ts), se avisa a Master por push
  // para que pueda entrar a apoyar -- no se espera a que termine
  // (best-effort) para no retrasar la respuesta al paciente.
  if (resultado.nota === "no_entendido_publico" && conversacionId) {
    void notificarApoyoConCliente(conversacionId, mensaje);
  }

  if (conversacionId) {
    try {
      if (resultado.mensajesBienvenida && resultado.mensajesBienvenida.length > 0) {
        await admin.from("chat_messages").insert(
          resultado.mensajesBienvenida.map((item) => ({
            lead_id: conversacionId,
            rol: "bot" as const,
            texto: item.tipo === "audio" ? "[audio de bienvenida]" : item.contenido,
          }))
        );
      } else {
        await admin.from("chat_messages").insert({ lead_id: conversacionId, rol: "bot", texto: resultado.respuesta });
      }
    } catch (err) {
      console.error("Error registrando la respuesta del bot:", err);
    }

    // Se guarda el estado completo de la conversacion (nuevoEstado) para
    // poder "retomarla" exactamente donde quedo si el visitante regresa
    // por el link de recordatorio (ver /api/public/asistente-whatsapp/retomar).
    try {
      await admin.from("chat_leads").update({ estado: resultado.nuevoEstado }).eq("id", conversacionId);
    } catch (err) {
      console.error("Error guardando el estado de la conversacion:", err);
    }
  }

  // Si justo en este turno se termino de agendar (el bot ya dio el
  // resumen final), se registra la cita de verdad en la plataforma --
  // igual que cuando Master agenda rapido desde su link privado
  // (/api/quick/book), pero sin bloquear la respuesta al paciente: si
  // algo sale mal (ej. ese horario ya se ocupo entre que se lo ofrecimos
  // y que confirmo), igual se le manda el resumen y el boton de WhatsApp
  // como siempre, y el error queda en los logs para revisarlo.
  const agendado = resultado.agendado;
  // Cuando la cita recien agendada es a domicilio, se manda tambien un
  // token (igual al que ya se usa para el link de /ubicacion/[id] que
  // se manda por WhatsApp) para que el chat pueda mostrar el boton de
  // "mandar mi ubicacion actual" sin tener que exponer el id real de
  // la cita sin protegerlo.
  let ubicacion: { appointmentId: string; token: string } | undefined;
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
      if (!resultadoCita.ok || !resultadoCita.appointmentId) {
        console.error("No se pudo registrar la cita del chat publico en la plataforma:", resultadoCita.error, agendado);
      } else {
        if (agendado.modalidadCodigo === "DOMICILIO") {
          ubicacion = {
            appointmentId: resultadoCita.appointmentId,
            token: generateConfirmToken(resultadoCita.appointmentId),
          };
        }
        if (conversacionId) {
          await admin
            .from("chat_leads")
            .update({ cerrada_con_cita: true, appointment_id: resultadoCita.appointmentId })
            .eq("id", conversacionId);
          // Ya se cerro con cita -- no hace falta que Master la revise, asi
          // que se borra el texto guardado (solo se quedan las que NO
          // cerraron, ver tabla chat_messages).
          await admin.from("chat_messages").delete().eq("lead_id", conversacionId);
        }
      }
    } catch (err) {
      console.error("Error registrando la cita del chat publico en la plataforma:", err);
    }
  }

  return NextResponse.json({ ...resultado, ubicacion });
}

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { generarRespuesta, ESTADO_INICIAL, normalizar, esRespuestaNegativaAgendar, type EstadoAgendado, type Correccion, type Anuncio, type Ubicacion } from "@/lib/whatsapp-bot/engine";
import { generarRespuestaPomada, ESTADO_INICIAL_PEDIDO, type EstadoPedido } from "@/lib/whatsapp-bot/engine-pomada";
import { obtenerSerieBienvenida } from "@/lib/whatsapp-bot/bienvenida";
import { crearCitaRapida } from "@/lib/appointments/quickBook";
import { generateConfirmToken } from "@/lib/appointments/tokens";
import { notificarApoyoConCliente } from "@/lib/push/send";
import { obtenerBotIdPorSlug, esBotSlugValido } from "@/lib/whatsapp-bot/bots";

// Version PUBLICA (sin login) del "cerebro" del bot -- para la pagina
// de demo que Vic manda por link a quien quiera (/demo-whatsapp).
// A proposito NO permite ensenar correcciones ni subir/borrar escritos
// de anuncios -- eso sigue siendo solo para Vic desde /master. Aqui
// solo se lee lo que ya esta guardado (correcciones + anuncios) para
// que conteste igual que en la demo de Master, pero sin poder
// modificar nada.
//
// Desde la Fase 1/2 del bot de venta de productos puede haber mas de un
// bot (ver src/lib/whatsapp-bot/bots.ts): "consultas" usa el cerebro de
// citas (engine.ts) y "pomada" usa el cerebro de ventas de la Pomada
// Barak Flex (engine-pomada.ts) -- son conversaciones muy distintas, asi
// que de aqui en adelante cada quien sigue su propio camino.
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-publico:${ip}`, 40, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({})) as {
    mensaje?: string;
    estado?: EstadoAgendado | EstadoPedido;
    conversacionId?: string;
    origen?: string;
    codigoAnuncio?: string;
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
          bot_id: botId,
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
      // recordatorio, ver /api/cron/recordatorio-chat) y se reinicia el
      // nivel de recordatorio a 0, para que si ya se le habian mandado
      // uno o varios avisos antes y volvio a escribir, se le puedan
      // volver a mandar los 3 desde el principio si se vuelve a quedar
      // callado. PERO si lo que contesto fue un "no" a que si quiere
      // agendar (ej. despues del aviso de las 2 horas), no tiene caso
      // seguirle insistiendo con el ultimo aviso del dia siguiente -- se
      // deja en nivel 3 (ya se mandaron todos) para cancelarlo de una vez.
      const nivelRecordatorio = esRespuestaNegativaAgendar(normalizar(mensaje)) ? 3 : 0;
      await admin
        .from("chat_leads")
        .update({ updated_at: new Date().toISOString(), recordatorio_enviado_at: null, recordatorio_nivel: nivelRecordatorio })
        .eq("id", conversacionId);
    } catch (err) {
      console.error("Error registrando el chat_lead:", err);
    }
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

  // El bot de la pomada sigue su propio camino de aqui en adelante: su
  // propio cerebro (sin sintomas de citas, sin consultorios), su propio
  // resumen de cierre ("pedido" en vez de "agendado") y su propia tabla
  // (pomada_pedidos en vez de appointments).
  if (botSlug === "pomada") {
    const estado: EstadoPedido = (body.estado as EstadoPedido) ?? ESTADO_INICIAL_PEDIDO;
    const resultado = await generarRespuestaPomada({ mensaje, estado, correcciones, anuncios, bienvenida, canalPublico: true });

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
              texto: item.tipo === "audio" ? "[audio de bienvenida]" : item.tipo === "video" ? "[video de bienvenida]" : item.contenido,
            }))
          );
        } else if (resultado.respuesta) {
          await admin.from("chat_messages").insert({ lead_id: conversacionId, rol: "bot", texto: resultado.respuesta });
        }
        await admin.from("chat_leads").update({ estado: resultado.nuevoEstado }).eq("id", conversacionId);
      } catch (err) {
        console.error("Error registrando la respuesta del bot de pomada:", err);
      }
    }

    // Si justo en este turno se termino de cerrar el pedido, se
    // registra de verdad en pomada_pedidos -- igual que con las citas,
    // sin bloquear la respuesta al cliente si algo sale mal.
    let ubicacion: { appointmentId: string; token: string } | undefined;
    const pedido = resultado.pedido;
    if (pedido) {
      try {
        const { data: pedidoCreado, error: pedidoError } = await admin
          .from("pomada_pedidos")
          .insert({
            chat_lead_id: conversacionId ?? null,
            nombre: pedido.nombre,
            celular: pedido.celular,
            cantidad: pedido.cantidad,
            precio_unitario: pedido.precioUnitario,
            precio_total: pedido.precioTotal,
            direccion: pedido.direccion,
            horario: pedido.horario,
          })
          .select("id")
          .single();
        if (pedidoError || !pedidoCreado) {
          console.error("No se pudo registrar el pedido de pomada:", pedidoError, pedido);
        } else {
          ubicacion = { appointmentId: pedidoCreado.id as string, token: generateConfirmToken(pedidoCreado.id as string) };
          if (conversacionId) {
            // OJO: aqui se usa "pedido_id" (no "appointment_id") -- esa
            // columna tiene una FK estricta a la tabla "appointments" y
            // un pedido de producto no vive ahi (ver pomada_pedidos).
            await admin
              .from("chat_leads")
              .update({ cerrada_con_cita: true, pedido_id: pedidoCreado.id as string })
              .eq("id", conversacionId);
            await admin.from("chat_messages").delete().eq("lead_id", conversacionId);
          }
        }
      } catch (err) {
        console.error("Error registrando el pedido de pomada en la plataforma:", err);
      }
    }

    // Si el cliente pidio ver el catalogo (ver CATALOGO_KEYWORDS en
    // engine-pomada.ts), aqui se le rellenan los productos de verdad
    // (vivos, con sus fotos) -- el engine nada mas marco la intencion,
    // no conoce la base de datos.
    let productosCatalogo: {
      id: string;
      nombre: string;
      descripcion: string | null;
      precio: number;
      fotos: { id: string; url: string }[];
    }[] | undefined;
    if (resultado.mostrarCatalogo) {
      const { data: productosRaw } = await admin
        .from("productos")
        .select("id, nombre, descripcion, precio, producto_fotos(id, url, orden)")
        .eq("bot_id", botId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      type Row = {
        id: string;
        nombre: string;
        descripcion: string | null;
        precio: number;
        producto_fotos: { id: string; url: string; orden: number }[];
      };
      productosCatalogo = ((productosRaw ?? []) as unknown as Row[]).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: p.precio,
        fotos: [...p.producto_fotos].sort((a, b) => a.orden - b.orden).map((f) => ({ id: f.id, url: f.url })),
      }));
    }

    // El chat publico reusa el mismo nombre de campo "agendado" (y la
    // misma UI de "Confirmar por WhatsApp") para mostrar el resumen del
    // pedido -- ver construirMensajeWhatsapp en PublicChatDemo.tsx.
    const agendadoComoPedido = pedido
      ? {
          tipo: "pedido" as const,
          nombre: pedido.nombre,
          celular: pedido.celular,
          dia: "",
          hora: pedido.horario,
          modalidad: "Entrega a domicilio",
          lugar: pedido.direccion,
          personas: pedido.cantidad,
          costoTotal: pedido.precioTotal,
        }
      : undefined;

    return NextResponse.json({ ...resultado, agendado: agendadoComoPedido, ubicacion, productos: productosCatalogo });
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
    canalPublico: true,
    // Solo el bot "consultas" cae de respaldo al saludo generico de
    // DrNatury cuando no hay bienvenida configurada -- los demas bots
    // se quedan sin saludo mientras Master no les arme el suyo.
    usarBienvenidaGenerica: true,
  });

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
            texto: item.tipo === "audio" ? "[audio de bienvenida]" : item.tipo === "video" ? "[video de bienvenida]" : item.contenido,
          }))
        );
      } else if (resultado.respuesta) {
        await admin.from("chat_messages").insert({ lead_id: conversacionId, rol: "bot", texto: resultado.respuesta });
      }
      // Si no hay ni serie de bienvenida ni respuesta (bot sin saludo
      // configurado todavia, ver usarBienvenidaGenerica en engine.ts), no
      // se guarda nada -- no hay ninguna respuesta de verdad que registrar.
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

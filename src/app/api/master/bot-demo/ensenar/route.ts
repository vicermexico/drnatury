import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizar } from "@/lib/whatsapp-bot/engine";
import { obtenerBotIdPorSlug } from "@/lib/whatsapp-bot/bots";

// Lista todas las correcciones guardadas (ver CorreccionesManager.tsx) --
// para que Master pueda verlas todas de un jalon en vez de tener que
// volver a escribir el mensaje exacto de cada una para encontrarla en
// medio de una conversacion de prueba.
//
// Desde la Fase 1 del bot de venta de productos, cada bot (ver
// src/lib/whatsapp-bot/bots.ts) tiene sus propias correcciones -- "bot"
// en la query string (GET) o el body (POST/DELETE) dice de cual.
export async function GET(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const admin = createAdminClient();
  const botId = await obtenerBotIdPorSlug(admin, request.nextUrl.searchParams.get("bot") ?? "consultas");
  if (!botId) return NextResponse.json({ error: "BOT_NO_ENCONTRADO" }, { status: 400 });

  const { data, error: dbErr } = await admin
    .from("whatsapp_bot_correcciones")
    .select("id, disparador_original, respuesta, updated_at")
    .eq("bot_id", botId)
    .order("updated_at", { ascending: false });

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ correcciones: data ?? [] });
}

// Guarda una correccion que Master le "ensena" al bot desde la pagina de
// demo (ver /master/asistente-whatsapp): para el mensaje de paciente que
// manda aqui, la proxima vez se usara la respuesta indicada en vez de las
// reglas generales. Si ya existia una correccion para ese mismo mensaje
// (una vez normalizado), se actualiza en vez de duplicarla.
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-ensenar:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as {
    mensaje_paciente?: string;
    respuesta_correcta?: string;
    bot?: string;
  };

  const mensajePaciente = (body.mensaje_paciente ?? "").trim();
  const respuestaCorrecta = (body.respuesta_correcta ?? "").trim();
  if (!mensajePaciente || !respuestaCorrecta) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta el mensaje o la respuesta" }, { status: 400 });
  }

  const admin = createAdminClient();
  const botId = await obtenerBotIdPorSlug(admin, body.bot ?? "consultas");
  if (!botId) return NextResponse.json({ error: "BOT_NO_ENCONTRADO" }, { status: 400 });

  const { error: dbErr } = await admin
    .from("whatsapp_bot_correcciones")
    .upsert(
      {
        bot_id: botId,
        disparador: normalizar(mensajePaciente),
        disparador_original: mensajePaciente,
        respuesta: respuestaCorrecta,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "bot_id,disparador" }
    );

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Borra una correccion que ya no sirve (por ejemplo, porque el bot ya
// aprendio a contestar eso solo, de raiz, y la correccion vieja se
// quedo tapando esa mejora). Se puede identificar cual borrar por el
// mismo mensaje de paciente que se uso para ensenarla (como hace el
// boton "Olvidar" dentro del chat de prueba), o directamente por su id
// (como hace el panel de CorreccionesManager.tsx, que lista todas sin
// necesidad de volver a escribir el mensaje exacto).
export async function DELETE(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-olvidar:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as { mensaje_paciente?: string; id?: string; bot?: string };
  const id = (body.id ?? "").trim();
  const mensajePaciente = (body.mensaje_paciente ?? "").trim();
  if (!id && !mensajePaciente) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const query = admin.from("whatsapp_bot_correcciones").delete();
  let dbErr;
  if (id) {
    ({ error: dbErr } = await query.eq("id", id));
  } else {
    const botId = await obtenerBotIdPorSlug(admin, body.bot ?? "consultas");
    if (!botId) return NextResponse.json({ error: "BOT_NO_ENCONTRADO" }, { status: 400 });
    ({ error: dbErr } = await query.eq("disparador", normalizar(mensajePaciente)).eq("bot_id", botId));
  }

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

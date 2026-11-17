import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizar } from "@/lib/whatsapp-bot/engine";

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
  };

  const mensajePaciente = (body.mensaje_paciente ?? "").trim();
  const respuestaCorrecta = (body.respuesta_correcta ?? "").trim();
  if (!mensajePaciente || !respuestaCorrecta) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta el mensaje o la respuesta" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: dbErr } = await admin
    .from("whatsapp_bot_correcciones")
    .upsert(
      {
        disparador: normalizar(mensajePaciente),
        disparador_original: mensajePaciente,
        respuesta: respuestaCorrecta,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "disparador" }
    );

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

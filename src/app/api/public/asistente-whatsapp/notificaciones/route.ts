import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

// Guarda el push_token del VISITANTE del chat publico (anonimo, sin
// login) para poder avisarle si se queda a medias en la conversacion
// (ver CRON /api/cron/recordatorio-chat). Distinto del push_token de
// "profiles" que ya usan Master/pacientes logueados.
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-notificaciones:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({})) as {
    conversacionId?: string;
    token?: string;
  };

  const conversacionId = (body.conversacionId ?? "").trim();
  const token = (body.token ?? "").trim();
  if (!conversacionId || !token) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("chat_leads")
    .update({ push_token: token })
    .eq("id", conversacionId);

  if (error) {
    console.error("Error guardando push_token del visitante:", error.message);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

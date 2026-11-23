import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { ESTADO_INICIAL, type EstadoAgendado } from "@/lib/whatsapp-bot/engine";

// Cuando el visitante le da clic al link de recordatorio
// (drnatury.com/chat?retomar=<id>), el chat llama esta ruta para
// reconstruir exactamente donde se quedo: el estado de la platica
// (EstadoAgendado) y los mensajes que ya se habian intercambiado.
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`bot-demo-retomar:${ip}`, 40, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: lead } = await admin
    .from("chat_leads")
    .select("id, estado, cerrada_con_cita")
    .eq("id", id)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ encontrada: false });
  }

  if (lead.cerrada_con_cita) {
    // Ya se agendo la cita en esta conversacion -- no tiene sentido
    // "retomarla", se le avisa al chat para que arranque una nueva.
    return NextResponse.json({ encontrada: true, cerrada: true });
  }

  const { data: mensajesRaw } = await admin
    .from("chat_messages")
    .select("rol, texto, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: true });

  const mensajes = (mensajesRaw ?? []).map((m) => ({
    rol: m.rol as "paciente" | "bot",
    texto: m.texto as string,
  }));

  const estado: EstadoAgendado = (lead.estado as EstadoAgendado | null) ?? ESTADO_INICIAL;

  return NextResponse.json({ encontrada: true, cerrada: false, estado, mensajes });
}

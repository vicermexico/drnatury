import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPushDirecto, notificarSeguimientoPendiente } from "@/lib/push/send";
import type { EstadoAgendado } from "@/lib/whatsapp-bot/engine";

// A diferencia de los otros CRON (reminders, low-stock) este NO lo
// dispara Vercel -- Vercel en este plan solo deja correr un cron una
// vez al dia, y aqui necesitamos revisar cada 1-2 minutos. En su lugar
// lo dispara un job de pg_cron+pg_net dentro de Supabase (ver migracion
// "cron_recordatorio_chat"), que le toca la puerta a esta ruta
// seguido, protegida igual que las demas con un secreto en el header.
//
// Busca conversaciones del chat publico (/chat) que:
//  - no se cerraron con cita (cerrada_con_cita = false)
//  - lleven 3+ minutos sin que el visitante escriba (updated_at viejo)
//  - todavia no se les mando el recordatorio (recordatorio_enviado_at null)
//
// Y le repite al visitante LA MISMA pregunta que le hizo el bot, con un
// link que lo regresa exactamente a esa conversacion -- si el visitante
// no activo su propia notificacion pero si dejo su celular durante la
// platica, en vez de avisarle a el se le avisa a Master (push
// "Seguimiento pendiente") para que le mande el link por WhatsApp a mano.
const LIMITE_MINUTOS = 3;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CHAT_RECORDATORIO_SECRET}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const admin = createAdminClient();
  const corte = new Date(Date.now() - LIMITE_MINUTOS * 60 * 1000).toISOString();

  const { data: leads, error } = await admin
    .from("chat_leads")
    .select("id, estado, push_token")
    .eq("cerrada_con_cita", false)
    .is("recordatorio_enviado_at", null)
    .lte("updated_at", corte);

  if (error) {
    console.error("[CRON recordatorio-chat] Error:", error.message);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  let revisados = 0;
  let avisadosVisitante = 0;
  let avisadosMaster = 0;

  for (const lead of leads ?? []) {
    revisados++;
    const id = lead.id as string;

    const { data: ultimoBot } = await admin
      .from("chat_messages")
      .select("texto")
      .eq("lead_id", id)
      .eq("rol", "bot")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const texto = (ultimoBot?.texto as string | undefined) || "¿Seguimos con su cita?";
    const estado = lead.estado as EstadoAgendado | null;
    const celular = estado?.celular;
    const pushToken = lead.push_token as string | null;

    try {
      if (pushToken) {
        await enviarPushDirecto(pushToken, "DrNatury", texto, `/chat?retomar=${id}`);
        avisadosVisitante++;
      } else if (celular) {
        await notificarSeguimientoPendiente(id, texto);
        avisadosMaster++;
      }
      // Si no hay ni push_token ni celular no hay nada que hacer -- de
      // todas formas se marca como revisado para no seguirlo intentando
      // cada 1-2 minutos para siempre.
    } catch (err) {
      console.error(`[CRON recordatorio-chat] Error avisando de ${id}:`, err);
    }

    await admin
      .from("chat_leads")
      .update({ recordatorio_enviado_at: new Date().toISOString() })
      .eq("id", id);
  }

  console.log(`[CRON recordatorio-chat] Revisados: ${revisados}, avisados al visitante: ${avisadosVisitante}, avisados a Master: ${avisadosMaster}`);
  return NextResponse.json({ revisados, avisadosVisitante, avisadosMaster });
}

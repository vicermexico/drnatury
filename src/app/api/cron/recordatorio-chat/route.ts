import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPushDirecto, notificarSeguimientoPendiente } from "@/lib/push/send";

// A diferencia de los otros CRON (reminders, low-stock) este NO lo
// dispara Vercel -- Vercel en este plan solo deja correr un cron una
// vez al dia, y aqui necesitamos revisar cada 1-2 minutos. En su lugar
// lo dispara un job de pg_cron+pg_net dentro de Supabase (ver migracion
// "cron_recordatorio_chat"), que le toca la puerta a esta ruta
// seguido, protegida igual que las demas con un secreto en el header.
//
// Busca conversaciones del chat publico (/chat) que:
//  - no se cerraron con cita (cerrada_con_cita = false)
//  - todavia no se les mando el ultimo de los 3 avisos (recordatorio_nivel < 3)
//  - ya les toca el siguiente aviso segun cuanto llevan calladas
//    (updated_at, que se reinicia cada vez que el visitante escribe)
//
// Se manda hasta 3 avisos por conversacion, cada vez mas espaciados:
//  1) a los 2 minutos  -- se repite la misma pregunta que no contesto
//     (la ultima que hizo el bot).
//  2) a las 2 horas     -- "¿Le gustaría agendar su cita?"
//  3) al dia siguiente  -- "Estamos pendientes con su cita, ¿gusta
//     retomarla?"
// Despues del tercero ya no se vuelve a insistir.
//
// Cada aviso se escribe TAMBIEN dentro del chat (chat_messages, como si
// lo hubiera dicho el bot) para que si el visitante regresa por su
// cuenta -- sin darle clic a la notificacion -- ya lo encuentre
// esperandolo ahi. Si el visitante activo sus propias notificaciones
// tambien se le manda el push directo a el. Y sin importar si se le
// pudo avisar al visitante o no, a Master SIEMPRE se le avisa tambien
// de que esa conversacion se quedo a medias (push "Seguimiento
// pendiente"), para que el mismo pueda darle seguimiento por WhatsApp.
const NIVELES: { minutos: number; texto: (ultimoBot: string) => string }[] = [
  { minutos: 2, texto: (ultimoBot) => ultimoBot || "¿Seguimos con su cita?" },
  { minutos: 120, texto: () => "¿Le gustaría agendar su cita?" },
  { minutos: 60 * 24, texto: () => "Estamos pendientes con su cita, ¿gusta retomarla?" },
];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CHAT_RECORDATORIO_SECRET}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const admin = createAdminClient();
  // Trae candidatos con el corte del PRIMER nivel (el mas chico) -- el
  // filtro exacto de cada renglon (segun en que nivel vaya) se hace
  // abajo, uno por uno, porque cada conversacion puede estar esperando
  // un tiempo distinto.
  const corteMinimo = new Date(Date.now() - NIVELES[0].minutos * 60 * 1000).toISOString();

  const { data: leads, error } = await admin
    .from("chat_leads")
    .select("id, push_token, updated_at, recordatorio_nivel")
    .eq("cerrada_con_cita", false)
    .lt("recordatorio_nivel", NIVELES.length)
    .lte("updated_at", corteMinimo);

  if (error) {
    console.error("[CRON recordatorio-chat] Error:", error.message);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  let revisados = 0;
  let avisadosVisitante = 0;
  let avisadosMaster = 0;
  const ahoraMs = Date.now();

  for (const lead of leads ?? []) {
    const id = lead.id as string;
    const nivelActual = (lead.recordatorio_nivel as number | null) ?? 0;
    if (nivelActual >= NIVELES.length) continue;

    const umbral = NIVELES[nivelActual];
    const updatedAtMs = new Date(lead.updated_at as string).getTime();
    // Todavia no le toca este nivel -- no lleva suficiente tiempo callada.
    if (ahoraMs - updatedAtMs < umbral.minutos * 60 * 1000) continue;

    revisados++;
    const pushToken = lead.push_token as string | null;

    const { data: ultimoBot } = await admin
      .from("chat_messages")
      .select("texto")
      .eq("lead_id", id)
      .eq("rol", "bot")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const texto = umbral.texto((ultimoBot?.texto as string | undefined) ?? "");

    try {
      // Se escribe en el chat para que, si el visitante regresa por su
      // cuenta, lo vea ahi esperandolo.
      await admin.from("chat_messages").insert({ lead_id: id, rol: "bot", texto });

      if (pushToken) {
        await enviarPushDirecto(pushToken, "DrNatury", texto, `/chat?retomar=${id}`);
        avisadosVisitante++;
      }
      // Sin importar si se le pudo avisar al visitante, a Master
      // siempre se le avisa tambien.
      await notificarSeguimientoPendiente(id, texto);
      avisadosMaster++;
    } catch (err) {
      console.error(`[CRON recordatorio-chat] Error avisando de ${id}:`, err);
    }

    await admin
      .from("chat_leads")
      .update({ recordatorio_enviado_at: new Date().toISOString(), recordatorio_nivel: nivelActual + 1 })
      .eq("id", id);
  }

  console.log(`[CRON recordatorio-chat] Revisados: ${revisados}, avisados al visitante: ${avisadosVisitante}, avisados a Master: ${avisadosMaster}`);
  return NextResponse.json({ revisados, avisadosVisitante, avisadosMaster });
}

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { RangoFechas } from "../mensajes/RangoFechas";
import { esBotSlugValido, obtenerBotIdPorSlug } from "@/lib/whatsapp-bot/bots";

// Lista de conversaciones del chat publico (/chat) que NO se cerraron
// con cita -- para que Master pueda entrar a cada una, ver en donde se
// "rego" el bot, y ensenarle la respuesta correcta (ver [id]/page.tsx).
// Solo se listan las que todavia tienen mensajes guardados: en cuanto
// una se cierra con cita, su texto se borra (ver
// /api/public/asistente-whatsapp) y ya no aparece aqui.

interface LeadPorRevisar {
  id: string;
  created_at: string;
  origen: string;
  primer_mensaje: string | null;
  total_mensajes: number;
}

async function getLeadsPorRevisar(botId: string, desde: string | null, hasta: string | null): Promise<LeadPorRevisar[]> {
  const admin = createAdminClient();
  let query = admin
    .from("chat_leads")
    .select("id, created_at, origen, chat_messages(rol, texto, created_at)")
    .eq("cerrada_con_cita", false)
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });

  if (desde) query = query.gte("created_at", `${desde}T06:00:00Z`);
  if (hasta) {
    const hastaFin = new Date(`${hasta}T06:00:00Z`);
    hastaFin.setUTCDate(hastaFin.getUTCDate() + 1);
    query = query.lt("created_at", hastaFin.toISOString());
  }

  const { data } = await query;
  type Row = { id: string; created_at: string; origen: string; chat_messages: { rol: string; texto: string; created_at: string }[] };
  const rows = (data ?? []) as unknown as Row[];

  // Solo interesan las que de verdad tienen algo que revisar (al menos
  // un mensaje del paciente guardado).
  return rows
    .filter((r) => r.chat_messages && r.chat_messages.length > 0)
    .map((r) => {
      const ordenados = [...r.chat_messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const primerPaciente = ordenados.find((m) => m.rol === "paciente");
      return {
        id: r.id,
        created_at: r.created_at,
        origen: r.origen,
        primer_mensaje: primerPaciente?.texto ?? null,
        total_mensajes: ordenados.length,
      };
    });
}

export default async function RevisionChatPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; bot?: string }>;
}) {
  const { desde, hasta, bot: botParam } = await searchParams;
  const bot = esBotSlugValido(botParam) ? botParam : "consultas";
  const admin = createAdminClient();
  const botId = await obtenerBotIdPorSlug(admin, bot);
  const leads = botId ? await getLeadsPorRevisar(botId, desde ?? null, hasta ?? null) : [];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`/master/asistente-whatsapp?bot=${bot}`} className="text-sm text-blue-600 hover:underline">
          ← Asistente de WhatsApp
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Revisar mensajes no cerrados</h1>
        <p className="text-sm text-gray-500 mt-1">
          Aqui puedes leer las conversaciones que NO terminaron en cita, ver en donde se le fue mal al bot
          y enseñarle la respuesta correcta para que vaya aprendiendo.
        </p>
      </div>

      <RangoFechas />

      {leads.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          No hay conversaciones sin cerrar que revisar en este rango.
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((l) => (
            <Link
              key={l.id}
              href={`/master/asistente-whatsapp/revision/${l.id}`}
              className="block rounded-xl bg-white border border-gray-200 px-4 py-3 hover:border-amber-300 hover:bg-amber-50/50 transition"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">
                    {l.primer_mensaje || "(sin mensaje)"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {l.total_mensajes} mensaje{l.total_mensajes !== 1 ? "s" : ""} · {l.origen === "inicio" ? "Agenda tu cita" : "Anuncio"}
                  </p>
                </div>
                <p className="text-xs text-gray-400 shrink-0">
                  {new Date(l.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

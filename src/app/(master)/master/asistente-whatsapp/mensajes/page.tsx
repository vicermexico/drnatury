import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { SearchInput } from "@/components/ui/SearchInput";
import { RangoFechas } from "./RangoFechas";
import { esBotSlugValido, obtenerBotIdPorSlug } from "@/lib/whatsapp-bot/bots";

// Resumen de los mensajes que entraron por el chat publico (/chat):
// cuantos llegaron, cuantos se cerraron con cita y cuantos no, en un
// rango de fechas -- y de los que si se cerraron, la lista con nombre,
// cuantas personas y en que lugar (sucursal o "a domicilio"), para que
// Master pueda buscar por ejemplo "San Blas" o "domicilio".

interface ChatLeadRow {
  id: string;
  created_at: string;
  cerrada_con_cita: boolean;
  appointments: {
    quick_name: string | null;
    num_personas: number | null;
    modalidad: "CONSULTORIO" | "DOMICILIO" | null;
    domicilio_direccion: string | null;
    branches: { name: string } | null;
  } | null;
}

async function getChatLeads(botId: string, desde: string | null, hasta: string | null) {
  const admin = createAdminClient();
  let query = admin
    .from("chat_leads")
    .select(`
      id, created_at, cerrada_con_cita,
      appointments:appointment_id ( quick_name, num_personas, modalidad, domicilio_direccion, branches(name) )
    `)
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });

  if (desde) query = query.gte("created_at", `${desde}T06:00:00Z`);
  if (hasta) {
    const hastaFin = new Date(`${hasta}T06:00:00Z`);
    hastaFin.setUTCDate(hastaFin.getUTCDate() + 1);
    query = query.lt("created_at", hastaFin.toISOString());
  }

  const { data } = await query;
  return (data ?? []) as unknown as ChatLeadRow[];
}

function lugarDe(row: ChatLeadRow): string {
  const a = row.appointments;
  if (!a) return "—";
  if (a.modalidad === "DOMICILIO") return `A domicilio${a.domicilio_direccion ? ` (${a.domicilio_direccion})` : ""}`;
  const branch = Array.isArray(a.branches) ? a.branches[0] : a.branches;
  return branch?.name ? `Consultorio ${branch.name}` : "Consultorio";
}

export default async function MensajesChatPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; q?: string; bot?: string }>;
}) {
  const { desde, hasta, q, bot: botParam } = await searchParams;
  const bot = esBotSlugValido(botParam) ? botParam : "consultas";
  const admin = createAdminClient();
  const botId = await obtenerBotIdPorSlug(admin, bot);
  const leads = botId ? await getChatLeads(botId, desde ?? null, hasta ?? null) : [];

  const llegados = leads.length;
  const cerrados = leads.filter((l) => l.cerrada_con_cita);
  const noCerrados = llegados - cerrados.length;

  const busqueda = (q ?? "").trim().toLowerCase();
  const cerradosFiltrados = busqueda
    ? cerrados.filter((l) => {
        const a = l.appointments;
        const branch = a ? (Array.isArray(a.branches) ? a.branches[0] : a.branches) : null;
        const texto = [
          a?.quick_name ?? "",
          lugarDe(l),
          branch?.name ?? "",
          a?.modalidad === "DOMICILIO" ? "domicilio" : "",
        ].join(" ").toLowerCase();
        return texto.includes(busqueda);
      })
    : cerrados;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`/master/asistente-whatsapp?bot=${bot}`} className="text-sm text-blue-600 hover:underline">
          ← Asistente de WhatsApp
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Mensajes del chat</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cuantos mensajes llegaron por el chat de tu pagina (/chat) y cuantos se cerraron con cita.
        </p>
      </div>

      <RangoFechas />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{llegados}</p>
          <p className="text-xs text-gray-500 mt-1">Mensajes llegados</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700">{cerrados.length}</p>
          <p className="text-xs text-emerald-700/80 mt-1">Cerrados con cita</p>
        </div>
        <Link
          href={`/master/asistente-whatsapp/revision?bot=${bot}`}
          className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-center hover:border-amber-400 transition"
        >
          <p className="text-2xl font-bold text-amber-700">{noCerrados}</p>
          <p className="text-xs text-amber-700/80 mt-1">No cerrados</p>
          <p className="text-[10px] text-amber-600 mt-0.5 underline">Revisar</p>
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-700">Citas cerradas por chat</h2>
          <div className="w-56">
            <SearchInput placeholder="Buscar lugar o nombre…" />
          </div>
        </div>

        {cerradosFiltrados.length === 0 ? (
          <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            {busqueda ? "No hay citas cerradas que coincidan con esa búsqueda." : "Todavía no hay citas cerradas por chat en este rango."}
          </div>
        ) : (
          <div className="space-y-2">
            {cerradosFiltrados.map((l) => {
              const a = l.appointments;
              return (
                <div key={l.id} className="rounded-xl bg-white border border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{a?.quick_name || "(sin nombre)"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{lugarDe(l)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-gray-700">
                      {a?.num_personas ?? 1} persona{(a?.num_personas ?? 1) !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(l.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

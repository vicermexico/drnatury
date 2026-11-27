import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { SearchInput } from "@/components/ui/SearchInput";
import { RangoFechas } from "./RangoFechas";
import { esBotSlugValido, obtenerBotIdPorSlug } from "@/lib/whatsapp-bot/bots";

// Resumen de los mensajes que entraron por el chat publico (/chat o
// /barak-flex, segun el bot): cuantos llegaron, cuantos se cerraron
// (con cita o con pedido, segun el bot) y cuantos no, en un rango de
// fechas -- y de los que si se cerraron, la lista con los datos de la
// cita o del pedido, para que Master pueda buscar.

interface ChatLeadRowCitas {
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

interface ChatLeadRowPedidos {
  id: string;
  created_at: string;
  cerrada_con_cita: boolean;
  pomada_pedidos: {
    nombre: string | null;
    celular: string | null;
    cantidad: number | null;
    direccion: string | null;
    horario: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
}

async function getChatLeadsCitas(botId: string, desde: string | null, hasta: string | null) {
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
  return (data ?? []) as unknown as ChatLeadRowCitas[];
}

async function getChatLeadsPedidos(botId: string, desde: string | null, hasta: string | null) {
  const admin = createAdminClient();
  let query = admin
    .from("chat_leads")
    .select(`
      id, created_at, cerrada_con_cita,
      pomada_pedidos:pedido_id ( nombre, celular, cantidad, direccion, horario, lat, lng )
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
  return (data ?? []) as unknown as ChatLeadRowPedidos[];
}

// Link de WhatsApp para hablarle directo al cliente desde la lista --
// el celular se guarda a 10 digitos (ver extraerCelular en
// engine-pomada.ts), asi que solo se le pega el 52 de Mexico.
function linkWhatsApp(celular: string | null | undefined): string | null {
  if (!celular) return null;
  const digits = celular.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/52${digits.slice(-10)}`;
}

// Link de Google Maps para el pin que el cliente compartio por GPS --
// si no compartio ubicacion (lat/lng nulos) no hay link, se muestra la
// direccion escrita nada mas.
function linkUbicacion(lat: number | null, lng: number | null): string | null {
  if (lat === null || lng === null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// El horario de entrega viene como un solo texto ("jueves 26 de
// noviembre de 2026, Tarde (5:00pm a 8:00pm)") -- de ahi se saca nada
// mas si es Mañana o Tarde para pintar la etiqueta de color.
function bloqueDeHorario(horario: string | null): "manana" | "tarde" | null {
  if (!horario) return null;
  const n = horario.toLowerCase();
  if (n.includes("mañana") || n.includes("manana")) return "manana";
  if (n.includes("tarde")) return "tarde";
  return null;
}

function lugarDeCita(row: ChatLeadRowCitas): string {
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
  const esPomada = bot === "pomada";
  const admin = createAdminClient();
  const botId = await obtenerBotIdPorSlug(admin, bot);

  const busqueda = (q ?? "").trim().toLowerCase();

  if (esPomada) {
    const leads = botId ? await getChatLeadsPedidos(botId, desde ?? null, hasta ?? null) : [];
    const llegados = leads.length;
    const cerrados = leads.filter((l) => l.cerrada_con_cita);
    const noCerrados = llegados - cerrados.length;
    const cerradosFiltrados = busqueda
      ? cerrados.filter((l) => {
          const p = l.pomada_pedidos;
          const texto = [p?.nombre ?? "", p?.direccion ?? "", p?.horario ?? ""].join(" ").toLowerCase();
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
            Cuantos mensajes llegaron por el chat de la pomada y cuantos se cerraron con pedido.
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
            <p className="text-xs text-emerald-700/80 mt-1">Cerrados con pedido</p>
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
            <h2 className="text-sm font-semibold text-gray-700">Pedidos cerrados por chat</h2>
            <div className="w-64">
              <SearchInput placeholder="Buscar nombre, dirección o día de entrega…" />
            </div>
          </div>

          {cerradosFiltrados.length === 0 ? (
            <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              {busqueda ? "No hay pedidos cerrados que coincidan con esa búsqueda." : "Todavía no hay pedidos cerrados por chat en este rango."}
            </div>
          ) : (
            <div className="space-y-2">
              {cerradosFiltrados.map((l) => {
                const p = l.pomada_pedidos;
                const wa = linkWhatsApp(p?.celular);
                const mapa = linkUbicacion(p?.lat ?? null, p?.lng ?? null);
                const bloque = bloqueDeHorario(p?.horario ?? null);
                return (
                  <div key={l.id} className="rounded-xl bg-white border border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p?.nombre || "(sin nombre)"}</p>
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir chat de WhatsApp"
                            className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-emerald-600 hover:bg-emerald-50 transition"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                              <path d="M17.472 14.382c-.297-.149-1.758-.868-2.03-.967-.273-.099-.472-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.372-.01-.571-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                              <path d="M12.004 2.003c-5.514 0-9.997 4.483-9.997 9.997 0 1.762.462 3.48 1.34 4.993L2 22l5.13-1.341a9.96 9.96 0 0 0 4.874 1.241h.004c5.514 0 9.997-4.483 9.997-9.997 0-2.67-1.04-5.18-2.928-7.07a9.935 9.935 0 0 0-7.073-2.83zm0 18.187h-.003a8.2 8.2 0 0 1-4.178-1.144l-.3-.178-3.047.797.813-2.97-.195-.306a8.193 8.193 0 0 1-1.257-4.39c0-4.529 3.686-8.214 8.217-8.214a8.157 8.157 0 0 1 5.81 2.407 8.157 8.157 0 0 1 2.406 5.81c0 4.53-3.686 8.188-8.266 8.188z"/>
                            </svg>
                          </a>
                        )}
                      </div>
                      {mapa ? (
                        <a
                          href={mapa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-0.5 inline-flex items-center gap-1"
                        >
                          📍 Ubicación compartida por GPS
                        </a>
                      ) : (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{p?.direccion || "—"}</p>
                      )}
                      {bloque && (
                        <span
                          className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            bloque === "manana" ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-700"
                          }`}
                        >
                          {bloque === "manana" ? "☀️ Mañana" : "🌙 Tarde"}
                        </span>
                      )}
                      {p?.horario && <p className="text-[11px] text-gray-400 mt-1">{p.horario}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-gray-700">
                        {p?.cantidad ?? 1} {p?.cantidad === 1 ? "pomada" : "pomadas"}
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

  const leads = botId ? await getChatLeadsCitas(botId, desde ?? null, hasta ?? null) : [];
  const llegados = leads.length;
  const cerrados = leads.filter((l) => l.cerrada_con_cita);
  const noCerrados = llegados - cerrados.length;
  const cerradosFiltrados = busqueda
    ? cerrados.filter((l) => {
        const a = l.appointments;
        const branch = a ? (Array.isArray(a.branches) ? a.branches[0] : a.branches) : null;
        const texto = [
          a?.quick_name ?? "",
          lugarDeCita(l),
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
                    <p className="text-xs text-gray-500 mt-0.5">{lugarDeCita(l)}</p>
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

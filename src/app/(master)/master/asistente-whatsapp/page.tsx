import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActivarNotificacionesApoyo } from "@/components/layout/master/ActivarNotificacionesApoyo";
import { BotSelector } from "./BotSelector";
import { esBotSlugValido, botVendeProductos, type BotSlug } from "@/lib/whatsapp-bot/bots";

// Pagina principal del Asistente de WhatsApp -- antes tenia todo junto
// en una sola pagina (perfil, bienvenida, anuncios, correcciones y el
// chat de prueba, uno debajo del otro), pero quedaba muy amontonado.
// Ahora es nada mas un menu de botones: cada quien vive en su propia
// pagina.
//
// Desde la Fase 1 del bot de venta de productos (ver
// src/lib/whatsapp-bot/bots.ts) puede haber mas de un bot -- sin
// "?bot=" en el link se ve primero el selector (BotSelector) para
// elegir con cual trabajar; con "?bot=<slug>" se ve este mismo menu de
// siempre, pero scoped a ese bot (todos los links cargan el "?bot=").
function seccionesDe(bot: BotSlug) {
  const q = `?bot=${bot}`;
  const secciones = [
    {
      href: `/master/asistente-whatsapp/probar${q}`,
      icono: "💬",
      titulo: "Probar y entrenar al bot",
      descripcion: "Escribe como si fueras un paciente para ver qué contesta",
    },
    {
      href: `/master/asistente-whatsapp/perfil${q}`,
      icono: "🙂",
      titulo: "Perfil del chat",
      descripcion: "Nombre, foto y link del anuncio que ve el paciente",
    },
    {
      href: `/master/asistente-whatsapp/bienvenida${q}`,
      icono: "👋",
      titulo: "Mensajes de bienvenida",
      descripcion: "Los audios y textos que se mandan al inicio",
    },
    {
      href: `/master/asistente-whatsapp/anuncios${q}`,
      icono: "📣",
      titulo: "Escritos de mis anuncios",
      descripcion: "Para que el bot sepa reconocer tus anuncios",
    },
    {
      href: `/master/asistente-whatsapp/links${q}`,
      icono: "🔗",
      titulo: "Links",
      descripcion: "Genera un link distinto por cada campaña para saber de cuál vino cada cliente",
    },
    {
      href: `/master/asistente-whatsapp/ubicaciones${q}`,
      icono: "📍",
      titulo: "Ubicaciones",
      descripcion: "Guarda el pin de cada consultorio parado ahí para que el bot lo mande",
    },
    {
      href: `/master/asistente-whatsapp/correcciones${q}`,
      icono: "🎓",
      titulo: "Correcciones que le has enseñado",
      descripcion: "Revisa y borra lo que ya no haga falta",
    },
    {
      href: `/master/asistente-whatsapp/revision${q}`,
      icono: "⚠️",
      titulo: "Revisión",
      descripcion: "Conversaciones que no terminaron en cita",
    },
    {
      href: `/master/asistente-whatsapp/mensajes${q}`,
      icono: "📊",
      titulo: "Ver mensajes",
      descripcion: "Cuántos mensajes llegaron y cuántos cerraron con cita",
    },
  ];

  // Choferes y Rutas solo le aplican a un bot que de verdad venda un
  // producto con entrega a domicilio (ver Fase 2/3) -- "consultas" nada
  // mas agenda citas de consultorio, no tiene nada que entregar.
  if (botVendeProductos(bot)) {
    secciones.push(
      {
        href: `/master/asistente-whatsapp/productos${q}`,
        icono: "🛍️",
        titulo: "Productos",
        descripcion: "Sube tus productos con nombre, descripción, precio y fotos",
      },
      {
        href: `/master/asistente-whatsapp/choferes${q}`,
        icono: "🚚",
        titulo: "Choferes",
        descripcion: "Da de alta a los choferes que entregan los pedidos de este bot",
      },
      {
        href: `/master/asistente-whatsapp/rutas${q}`,
        icono: "🗺️",
        titulo: "Rutas",
        descripcion: "Agrupa los pedidos pendientes por cercanía y asígnalos a un chofer",
      }
    );
  }

  return secciones;
}

export default async function AsistenteWhatsappPage({
  searchParams,
}: {
  searchParams: Promise<{ bot?: string }>;
}) {
  const { bot } = await searchParams;
  if (!esBotSlugValido(bot)) {
    return <BotSelector />;
  }

  const admin = createAdminClient();
  const { data: botRow } = await admin.from("whatsapp_bots").select("nombre").eq("slug", bot).maybeSingle();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/master/asistente-whatsapp" className="text-sm text-blue-600 hover:underline">
          ← Cambiar de bot
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{botRow?.nombre ?? "Asistente de WhatsApp"} (demo)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Todavía NO está conectado a tu WhatsApp real, es solo de prueba.
        </p>
      </div>

      <ActivarNotificacionesApoyo />

      <div className="space-y-2">
        {seccionesDe(bot).map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/40 transition"
          >
            <span className="text-2xl shrink-0">{s.icono}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">{s.titulo}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.descripcion}</p>
            </div>
            <span className="text-gray-300 shrink-0">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

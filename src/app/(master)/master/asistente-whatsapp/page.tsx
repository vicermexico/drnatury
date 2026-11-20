import Link from "next/link";

// Pagina principal del Asistente de WhatsApp -- antes tenia todo junto
// en una sola pagina (perfil, bienvenida, anuncios, correcciones y el
// chat de prueba, uno debajo del otro), pero quedaba muy amontonado.
// Ahora es nada mas un menu de botones: cada quien vive en su propia
// pagina.
const SECCIONES = [
  {
    href: "/master/asistente-whatsapp/probar",
    icono: "💬",
    titulo: "Probar y entrenar al bot",
    descripcion: "Escribe como si fueras un paciente para ver qué contesta",
  },
  {
    href: "/master/asistente-whatsapp/perfil",
    icono: "🙂",
    titulo: "Perfil del chat",
    descripcion: "Nombre, foto y link del anuncio que ve el paciente",
  },
  {
    href: "/master/asistente-whatsapp/bienvenida",
    icono: "👋",
    titulo: "Mensajes de bienvenida",
    descripcion: "Los audios y textos que se mandan al inicio",
  },
  {
    href: "/master/asistente-whatsapp/anuncios",
    icono: "📣",
    titulo: "Escritos de mis anuncios",
    descripcion: "Para que el bot sepa reconocer tus anuncios",
  },
  {
    href: "/master/asistente-whatsapp/correcciones",
    icono: "🎓",
    titulo: "Correcciones que le has enseñado",
    descripcion: "Revisa y borra lo que ya no haga falta",
  },
  {
    href: "/master/asistente-whatsapp/revision",
    icono: "⚠️",
    titulo: "Revisión",
    descripcion: "Conversaciones que no terminaron en cita",
  },
  {
    href: "/master/asistente-whatsapp/mensajes",
    icono: "📊",
    titulo: "Ver mensajes",
    descripcion: "Cuántos mensajes llegaron y cuántos cerraron con cita",
  },
];

export default function AsistenteWhatsappPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Asistente de WhatsApp (demo)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Todavía NO está conectado a tu WhatsApp real, es solo de prueba.
        </p>
      </div>

      <div className="space-y-2">
        {SECCIONES.map((s) => (
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

import Link from "next/link";

// Menu de tarjetas reutilizable -- mismo patron que ya se uso en
// /master/asistente-whatsapp (ver seccionesDe() en ese archivo): cuando
// un boton del menu principal agrupa varias cosas, se le pone esta
// pantalla de tarjetas en vez de amontonar todo en una sola pagina.
export interface CardMenuItem {
  href: string;
  icono: string;
  titulo: string;
  descripcion: string;
}

export function CardMenu({ items }: { items: CardMenuItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((s) => (
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
  );
}

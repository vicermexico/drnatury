"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
const NAV = [
  { href: "/master/dashboard",  label: "Inicio",         icon: "🏠" },
  { href: "/master/pacientes",  label: "Pacientes",      icon: "👤" },
  { href: "/master/citas",      label: "Citas",          icon: "📅" },
  { href: "/master/asistentes", label: "Asistentes",     icon: "🤝" },
  { href: "/master/whatsapp",   label: "Notificaciones", icon: "🔔" },
  { href: "/master/reportes",   label: "Reportes",       icon: "📊" },
  { href: "/master/landing",    label: "Editar inicio",  icon: "🌐" },
  { href: "/master/inventario", label: "Productos",      icon: "📦" },
  { href: "/master/terapeutas", label: "Terapeutas",     icon: "🧑‍⚕️" },
  { href: "/master/almacenistas", label: "Almacen",      icon: "📦" },
  { href: "/master/configuracion", label: "Configuracion", icon: "⚙️" },
  { href: "/master/whatsapp-citas",    label: "WhatsApp Citas",  icon: "💬" },
  { href: "/master/agua-energetica",  label: "Agua Energetica", icon: "💧" },
  { href: "/master/comisiones",     label: "Comisiones",     icon: "💰" },
  { href: "/master/cortes",         label: "Cortes",         icon: "✂️" },
];
interface Props {
  userName: string;
}
function SidebarContent({ userName, onClose, onLogout }: { userName: string; onClose?: () => void; onLogout: () => void }) {
  const pathname = usePathname();
  return (
    <aside className="flex flex-col w-60 h-[100dvh] max-h-[100dvh] bg-white border-r border-gray-200 overflow-hidden">
      <div className="shrink-0 px-5 py-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-base font-bold text-gray-900 leading-tight">DrNatury</p>
          <p className="text-xs text-gray-400 mt-0.5">Panel Master</p>
        </div>
        {onClose && (
          <button className="text-gray-400 hover:text-gray-600 text-lg" onClick={onClose}>✕</button>
        )}
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition",
                active
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              ].join(" ")}
            >
              <span className="text-base leading-none">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 px-3 pb-4 pt-2 border-t border-gray-100">
        <p className="px-3 text-xs text-gray-400 mb-2 truncate">{userName}</p>
        <button
          onClick={onLogout}
          className="w-full text-left px-3 py-2.5 text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
        >
          🚪 Cerrar sesion
        </button>
      </div>
    </aside>
  );
}
export function MasterSidebar({ userName }: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Mientras el menu esta abierto en celular, evita que la pagina de
    // atras se mueva al hacer scroll (por eso no se podia llegar hasta
    // "Cerrar sesion").
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/inicio";
  }
  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 bg-white border border-gray-200 rounded-lg p-2 shadow-sm"
        onClick={() => setOpen(true)}
      >
        <span className="block w-5 h-0.5 bg-gray-600 mb-1"></span>
        <span className="block w-5 h-0.5 bg-gray-600 mb-1"></span>
        <span className="block w-5 h-0.5 bg-gray-600"></span>
      </button>
      <div className="hidden lg:flex shrink-0">
        <SidebarContent userName={userName} onLogout={handleLogout} />
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-50">
            <SidebarContent userName={userName} onClose={() => setOpen(false)} onLogout={handleLogout} />
          </div>
        </div>
      )}
    </>
  );
}

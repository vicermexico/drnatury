"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// "Inicio" queda aparte, fijo arriba -- todo lo demas vive dentro de dos
// botones que se expanden (Dr Natury Consultorio / Marketing y Ventas),
// para que el menu no se vea tan largo. Antes todo esto era una sola
// lista plana (NAV) sin ningun agrupamiento.
const INICIO = { href: "/master/dashboard", label: "Inicio", icon: "🏠" };

interface NavItem { href: string; label: string; icon: string }
interface NavGroup { key: string; label: string; icon: string; items: NavItem[] }

const GROUPS: NavGroup[] = [
  {
    key: "consultorio",
    label: "Dr Natury Consultorio",
    icon: "🩺",
    items: [
      { href: "/master/pacientes",          label: "Pacientes",                   icon: "👤" },
      { href: "/master/citas",              label: "Citas",                       icon: "📅" },
      { href: "/master/empleados",          label: "Empleados",                   icon: "🧑‍💼" },
      { href: "/master/whatsapp",           label: "Notificaciones",              icon: "🔔" },
      { href: "/master/landing",            label: "Editar página antes de login", icon: "🌐" },
      { href: "/master/almacen",            label: "Almacén",                     icon: "📦" },
      { href: "/master/sucursales",         label: "Sucursales",                  icon: "🏢" },
      { href: "/master/servicios",          label: "Servicios Consultorio",       icon: "🛎️" },
      { href: "/master/servicios-domicilio", label: "Servicios a Domicilio",       icon: "🚐" },
      { href: "/master/servicios-extras",   label: "Servicios Extras",            icon: "✨" },
      { href: "/master/recetas",            label: "Recetas",                     icon: "📝" },
    ],
  },
  {
    key: "marketing",
    label: "Marketing y Ventas",
    icon: "📣",
    items: [
      { href: "/master/whatsapp-citas",     label: "WhatsApp Citas",        icon: "💬" },
      { href: "/master/asistente-whatsapp", label: "Asistente WhatsApp",    icon: "🤖" },
    ],
  },
];

interface Props {
  userName: string;
}

function NavLink({ href, label, icon, active, onClick }: NavItem & { active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
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
}

function SidebarContent({ userName, onClose, onLogout }: { userName: string; onClose?: () => void; onLogout: () => void }) {
  const pathname = usePathname();

  // El grupo que contiene la pagina actual arranca abierto, para que no
  // se "pierda" donde esta uno parado al navegar.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const activo = GROUPS.find((g) => g.items.some((i) => pathname.startsWith(i.href)));
    return new Set(activo ? [activo.key] : []);
  });

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

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
        <NavLink {...INICIO} active={pathname.startsWith(INICIO.href)} onClick={onClose} />

        <div className="h-2" />

        {GROUPS.map((group) => {
          const groupActive = group.items.some((i) => pathname.startsWith(i.href));
          const isOpen = expanded.has(group.key);
          return (
            <div key={group.key} className="pb-0.5">
              <button
                type="button"
                onClick={() => toggle(group.key)}
                className={[
                  "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm transition",
                  groupActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                <span className="flex items-center gap-3">
                  <span className="text-base leading-none">{group.icon}</span>
                  <span>{group.label}</span>
                </span>
                <span className={["text-xs text-gray-400 transition-transform", isOpen ? "rotate-90" : ""].join(" ")}>
                  ›
                </span>
              </button>
              {isOpen && (
                <div className="mt-0.5 ml-2 pl-2 border-l border-gray-100 space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)} onClick={onClose} />
                  ))}
                </div>
              )}
            </div>
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

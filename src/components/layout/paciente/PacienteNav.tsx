"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function PacienteNav() {
  const pathname = usePathname();
  const links = [
    { href: "/paciente/citas",           icon: "calendario", label: "Mis citas" },
    { href: "/paciente/agendar",         icon: "mas",        label: "Agendar" },
    { href: "/paciente/agua-energetica", icon: "vaso",       label: "Activar" },
    { href: "/paciente/perfil",          icon: "perfil",     label: "Mi perfil" },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-40">
      {links.map(({ href, icon, label }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href}
            className={`relative flex-1 flex flex-col items-center py-3 gap-0.5 transition ${
              active ? "text-emerald-500" : "text-gray-400 hover:text-emerald-400"
            }`}
          >
            {active && (
              <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-emerald-500 rounded-b" />
            )}
            <NavIcon type={icon} active={active} />
            <span className="text-[11px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
function NavIcon({ type, active }: { type: string; active: boolean }) {
  const stroke = active ? "#10b981" : "#9ca3af";
  if (type === "calendario") return <span className="text-xl">📅</span>;
  if (type === "mas") return <span className="text-xl">➕</span>;
  if (type === "perfil") return <span className="text-xl">👤</span>;
  if (type === "vaso") {
    // Vaso de vidrio con agua, para el acceso rapido de Agua Energetica
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M6.5 3h11l-1.4 15.4A2 2 0 0 1 14.1 20H9.9a2 2 0 0 1-2-1.6L6.5 3Z"
          stroke={stroke}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M7.2 10.5c1 .8 2 .8 3 0s2-.8 3 0 2 .8 3 0"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
        />
        <path d="M6.5 3h11" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
}

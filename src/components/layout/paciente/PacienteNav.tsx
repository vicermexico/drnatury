"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/paciente/citas",           icon: "calendario", label: "Mis citas", raised: false },
  { href: "/paciente/agua-energetica", icon: "vaso",       label: "Activar",   raised: false },
  { href: "/paciente/agendar",         icon: "mas",        label: "Agendar",   raised: true  },
  { href: "/paciente/perfil",          icon: "perfil",     label: "Mi perfil", raised: false },
] as const;

export function PacienteNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40">
      <div className="relative flex items-stretch bg-white border-t border-gray-100 rounded-t-[26px] px-1 pt-2 pb-3 shadow-[0_-8px_28px_-6px_rgba(15,23,42,0.10)]">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          if (link.raised) {
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex-1 flex flex-col items-center justify-end gap-1 -mt-7"
              >
                <span className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_10px_22px_-6px_rgba(16,185,129,0.6)] ring-4 ring-white transition active:scale-95">
                  <NavIcon type={link.icon} active raised />
                </span>
                <span className={`text-[11px] font-semibold ${active ? "text-emerald-600" : "text-gray-400"}`}>
                  {link.label}
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1"
            >
              <span
                className={`flex items-center justify-center w-11 h-11 rounded-2xl transition ${
                  active ? "bg-emerald-50" : ""
                }`}
              >
                <NavIcon type={link.icon} active={active} />
              </span>
              <span className={`text-[11px] font-medium ${active ? "text-emerald-600" : "text-gray-400"}`}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function NavIcon({ type, active, raised }: { type: string; active: boolean; raised?: boolean }) {
  const stroke = raised ? "#ffffff" : active ? "#059669" : "#9ca3af";
  const sw = raised ? "2.3" : "1.8";

  if (type === "calendario") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3.5" y="5" width="17" height="15" rx="3.2" stroke={stroke} strokeWidth={sw} />
        <path d="M3.5 9.7h17" stroke={stroke} strokeWidth={sw} />
        <path d="M8 3v3.2M16 3v3.2" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <circle cx="8.3" cy="13.6" r="1.05" fill={stroke} />
        <circle cx="12" cy="13.6" r="1.05" fill={stroke} />
        <circle cx="15.7" cy="13.6" r="1.05" fill={stroke} />
      </svg>
    );
  }
  if (type === "perfil") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8.3" r="3.6" stroke={stroke} strokeWidth={sw} />
        <path d="M4.8 19.6c1.2-3.7 4-5.5 7.2-5.5s6 1.8 7.2 5.5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "mas") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "vaso") {
    // Vaso de vidrio con agua, para el acceso rapido de Agua Energetica
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M6.5 3h11l-1.4 15.4A2 2 0 0 1 14.1 20H9.9a2 2 0 0 1-2-1.6L6.5 3Z"
          stroke={stroke}
          strokeWidth={sw}
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
        <path d="M6.5 3h11" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    );
  }
  return null;
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function PacienteNav() {
  const pathname = usePathname();

  const links = [
    { href: "/paciente/citas",           icon: "📅", label: "Mis citas" },
    { href: "/paciente/agendar",         icon: "➕", label: "Agendar" },
    { href: "/paciente/agua-energetica", icon: "💧", label: "Agua" },
    { href: "/paciente/perfil",          icon: "👤", label: "Mi perfil" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
      {links.map(({ href, icon, label }) => (
        <Link key={href} href={href}
          className={`relative flex-1 flex flex-col items-center py-3 gap-0.5 transition ${
            pathname === href ? "text-blue-600" : "text-gray-400 hover:text-blue-500"
          }`}
        >
          {pathname === href && (
            <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-blue-600 rounded-b" />
          )}
          <span className="text-xl">{icon}</span>
          <span className="text-[11px] font-medium">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
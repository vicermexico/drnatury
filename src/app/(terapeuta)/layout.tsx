import Link from "next/link";
import { getServerProfile } from "@/lib/auth";
import { TerapeutaMobileMenu } from "@/components/layout/terapeuta/TerapeutaMobileMenu";

const NAV = [
  { href: "/terapeuta/dashboard",       label: "Inicio"             },
  { href: "/terapeuta/agenda",          label: "Agenda de hoy"      },
  { href: "/terapeuta/pacientes",       label: "Pacientes"          },
  { href: "/terapeuta/inventario",      label: "Inventario"         },
  { href: "/terapeuta/agua-energetica", label: "Activación de agua" },
  { href: "/terapeuta/estado-cuenta",   label: "Estado de Cuenta"   },
];

export default async function TerapeutaLayout({ children }: { children: React.ReactNode }) {
  const profile = await getServerProfile();
  const rawBranch = (profile as { branches?: unknown } | null)?.branches;
  const branchName: string | null = rawBranch
    ? (Array.isArray(rawBranch)
        ? (rawBranch as { name: string }[])[0]?.name ?? null
        : (rawBranch as { name: string }).name ?? null)
    : null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden md:flex w-56 flex-col bg-white border-r border-gray-200 py-6 px-4 shrink-0">
        <div className="mb-6 px-2">
          <p className="text-[11px] text-gray-400 leading-none">DrNatury</p>
          {profile?.name && (
            <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{profile.name}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-medium">
              Terapeuta
            </span>
            {branchName && (
              <span className="text-[10px] text-gray-400">· {branchName}</span>
            )}
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href}
              className="flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition text-gray-600 hover:bg-gray-50 hover:text-gray-900">
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 px-2">
          <Link
            href="/terapeuta/citas/nueva"
            className="block w-full text-center text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-2 rounded-lg hover:bg-emerald-200 transition mb-2"
          >
            Agendar cita paciente
          </Link>
          <form action="/api/auth/logout" method="POST">
            <button type="submit"
              className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50 transition">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <TerapeutaMobileMenu nav={NAV} profileName={profile?.name ?? null} branchName={branchName} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}


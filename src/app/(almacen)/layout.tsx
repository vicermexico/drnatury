import Link from "next/link";
import { getServerProfile } from "@/lib/auth";

const NAV = [
  { href: "/almacen/dashboard",   label: "Inicio"      },
  { href: "/almacen/inventario",  label: "Inventario"  },
  { href: "/almacen/sucursales",  label: "Sucursales"  },
  { href: "/almacen/ventas",      label: "Ventas"      },
];

export default async function AlmacenLayout({ children }: { children: React.ReactNode }) {
  const profile = await getServerProfile();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden md:flex w-56 flex-col bg-white border-r border-gray-200 py-6 px-4 shrink-0">
        <div className="mb-6 px-2">
          <p className="text-[11px] text-gray-400 leading-none">DrBioescaner</p>
          {profile?.name && (
            <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{profile.name}</p>
          )}
          <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded mt-1 inline-block font-medium">
            AlmacÃ©n
          </span>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href}
              className="flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition">
              {label}
            </Link>
          ))}
        </nav>

        <form action="/api/auth/logout" method="POST" className="mt-4">
          <button type="submit"
            className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50 transition">
            Cerrar sesiÃ³n
          </button>
        </form>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-gray-400">DrBioescaner Â· AlmacÃ©n</p>
            {profile?.name && <p className="text-sm font-semibold text-gray-900">{profile.name}</p>}
          </div>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-xs text-gray-400 hover:text-gray-600">Salir</button>
          </form>
        </header>

        <nav className="md:hidden bg-white border-b border-gray-100 px-4 flex gap-1 overflow-x-auto">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href}
              className="shrink-0 py-2.5 px-3 text-sm font-medium text-gray-600 hover:text-blue-600 transition whitespace-nowrap">
              {label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}


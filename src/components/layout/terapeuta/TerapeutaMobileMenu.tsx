"use client";
import { useState } from "react";
import Link from "next/link";

interface NavItem {
  href: string;
  label: string;
}

export function TerapeutaMobileMenu({
  nav,
  profileName,
  branchName,
}: {
  nav: NavItem[];
  profileName: string | null;
  branchName: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="flex flex-col justify-center gap-1 p-2 -ml-2 rounded-lg hover:bg-gray-50 transition"
        >
          <span className="block w-5 h-0.5 bg-gray-700 rounded-full" />
          <span className="block w-5 h-0.5 bg-gray-700 rounded-full" />
          <span className="block w-5 h-0.5 bg-gray-700 rounded-full" />
        </button>
        <div className="text-right">
          <p className="text-[11px] text-gray-400">DrNatury · Terapeuta</p>
          {profileName && <p className="text-sm font-semibold text-gray-900">{profileName}</p>}
        </div>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <div className="w-72 max-w-[80vw] bg-white h-full flex flex-col py-6 px-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 px-2">
              <div>
                <p className="text-[11px] text-gray-400 leading-none">DrNatury</p>
                {profileName && <p className="text-sm font-semibold text-gray-900 mt-0.5">{profileName}</p>}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-medium">
                    Terapeuta
                  </span>
                  {branchName && <span className="text-[10px] text-gray-400">· {branchName}</span>}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {nav.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  {label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 px-2 space-y-2">
              <Link
                href="/terapeuta/citas/nueva"
                onClick={() => setOpen(false)}
                className="block w-full text-center text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-2 rounded-lg hover:bg-emerald-200 transition"
              >
                Agendar cita paciente
              </Link>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50 transition"
                >
                  Cerrar sesión
                </button>
              </form>
            </div>
          </div>
          <div className="flex-1 bg-black/40" />
        </div>
      )}
    </>
  );
}

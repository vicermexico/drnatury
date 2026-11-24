"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface BotUI {
  slug: string;
  nombre: string;
}

// Pantalla de entrada al Asistente de WhatsApp (Fase 1 del bot de venta
// de productos): en vez de entrar directo al unico bot que habia antes,
// ahora primero se elige CUAL bot administrar -- cada uno vive
// totalmente aparte (su propia bienvenida, anuncios, correcciones,
// ubicaciones y conversaciones). El nombre de cada boton se puede
// editar (el lapiz), pero no a cual bot corresponde por dentro.
export function BotSelector() {
  const router = useRouter();
  const [bots, setBots] = useState<BotUI[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editandoSlug, setEditandoSlug] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch("/api/master/bot-demo/bots");
      const data = await res.json().catch(() => null);
      setBots(data?.bots ?? []);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function guardarNombre(slug: string) {
    const nombre = borrador.trim();
    if (!nombre || guardando) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/master/bot-demo/bots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, nombre }),
      });
      if (res.ok) {
        setBots((prev) => prev.map((b) => (b.slug === slug ? { ...b, nombre } : b)));
        setEditandoSlug(null);
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Asistente de WhatsApp (demo)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Elige con cuál bot quieres trabajar -- cada uno es completamente independiente.
        </p>
      </div>

      {cargando ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {bots.map((b) => (
            <div
              key={b.slug}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/40 transition"
            >
              {editandoSlug === b.slug ? (
                <div className="space-y-2">
                  <input
                    value={borrador}
                    onChange={(e) => setBorrador(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => guardarNombre(b.slug)}
                      disabled={guardando}
                      className="text-xs font-semibold text-white bg-emerald-600 rounded-md px-3 py-1.5 disabled:opacity-60"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditandoSlug(null)}
                      className="text-xs text-gray-500 px-2 py-1.5"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => router.push(`/master/asistente-whatsapp?bot=${b.slug}`)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-base font-semibold text-gray-900 truncate">{b.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Entrar ›</p>
                  </button>
                  <button
                    onClick={() => {
                      setEditandoSlug(b.slug);
                      setBorrador(b.nombre);
                    }}
                    title="Cambiar nombre"
                    className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xs shrink-0"
                  >
                    ✏️
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

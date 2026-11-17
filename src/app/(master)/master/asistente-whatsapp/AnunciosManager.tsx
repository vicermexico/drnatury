"use client";
import { useEffect, useState } from "react";

interface AnuncioUI {
  id: string;
  texto: string;
  created_at: string;
}

export function AnunciosManager() {
  const [anuncios, setAnuncios] = useState<AnuncioUI[]>([]);
  const [cargando, setCargando] = useState(true);
  const [textoNuevo, setTextoNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch("/api/master/bot-demo/anuncios");
      const data = await res.json().catch(() => null);
      setAnuncios(data?.anuncios ?? []);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (abierto) cargar();
  }, [abierto]);

  async function agregar() {
    const texto = textoNuevo.trim();
    if (!texto || guardando) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/master/bot-demo/anuncios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      if (res.ok) {
        setTextoNuevo("");
        await cargar();
      }
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id: string) {
    setBorrandoId(id);
    try {
      const res = await fetch("/api/master/bot-demo/anuncios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setAnuncios((prev) => prev.filter((a) => a.id !== id));
      }
    } finally {
      setBorrandoId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium text-gray-700">📣 Escritos de mis anuncios</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Sube aquí los mensajes pre-llenados de tus anuncios para que el bot sepa reconocerlos
          </p>
        </div>
        <span className="text-gray-400">{abierto ? "▲" : "▼"}</span>
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            Si un primer mensaje NO coincide con ninguno de estos escritos, el bot avisará en vez de
            contestar el saludo automático (por ejemplo, si es un mensaje de seguimiento de alguien
            que ya atendiste, y no un clic nuevo a un anuncio). El código del inicio (B3, C6, etc.) no
            importa, se ignora solo. Mientras no subas ninguno, el bot sigue contestando el saludo a
            cualquier primer mensaje, como hasta ahora.
          </p>

          <div className="space-y-2">
            <textarea
              value={textoNuevo}
              onChange={(e) => setTextoNuevo(e.target.value)}
              rows={2}
              placeholder='Pega aquí el mensaje pre-llenado, ej: "B3 - ¡Hola! ¿Podrían darme más información?"'
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <button
              onClick={agregar}
              disabled={guardando || !textoNuevo.trim()}
              className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "+ Agregar escrito"}
            </button>
          </div>

          <div className="space-y-1.5">
            {cargando && <p className="text-xs text-gray-400">Cargando...</p>}
            {!cargando && anuncios.length === 0 && (
              <p className="text-xs text-gray-400">Todavía no has subido ningún escrito.</p>
            )}
            {anuncios.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-700 whitespace-pre-wrap flex-1">{a.texto}</p>
                <button
                  onClick={() => borrar(a.id)}
                  disabled={borrandoId === a.id}
                  className="text-[11px] text-gray-400 hover:text-red-600 disabled:opacity-50 shrink-0"
                >
                  {borrandoId === a.id ? "..." : "🗑️"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

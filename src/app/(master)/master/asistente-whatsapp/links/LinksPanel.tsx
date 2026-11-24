"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { BotSlug } from "@/lib/whatsapp-bot/bots";

interface BotLink {
  id: string;
  codigo: string;
  nota: string | null;
  leads: number;
  url: string;
}

function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(texto).then(() => {
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        });
      }}
      className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700"
    >
      {copiado ? "¡Copiado!" : "Copiar"}
    </button>
  );
}

export function LinksPanel({ bot }: { bot: BotSlug }) {
  const [links, setLinks] = useState<BotLink[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nota, setNota] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/master/bot-links?bot=${bot}`);
      const data = await res.json() as { links: BotLink[] };
      setLinks(data.links ?? []);
    } finally {
      setCargando(false);
    }
  }, [bot]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function crearLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/master/bot-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot, codigo, nota: nota || undefined }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) { setError(data.message ?? "Error al crear el link"); return; }
      setCodigo("");
      setNota("");
      await cargar();
    });
  }

  function borrarLink(id: string) {
    startTransition(async () => {
      await fetch(`/api/master/bot-links/${id}`, { method: "DELETE" });
      await cargar();
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={crearLink} className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Generar un link nuevo</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Texto del link *</label>
          <p className="text-xs text-gray-400 mb-1">Ej. &quot;promo-navidad&quot; -- se acomoda solo a minúsculas y sin espacios</p>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="promo-navidad"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej. Anuncio de Instagram de diciembre"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}
        <button type="submit" disabled={isPending}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {isPending ? "Generando…" : "Generar link"}
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Tus links</h2>
        {cargando ? (
          <p className="text-sm text-gray-400">Cargando…</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no has generado ningún link.</p>
        ) : (
          links.map((link) => (
            <div key={link.id} className="rounded-2xl bg-white border border-gray-200 p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{link.codigo}</p>
                  {link.nota && <p className="text-xs text-gray-500">{link.nota}</p>}
                </div>
                <span className="shrink-0 text-xs text-gray-400">{link.leads} conversación{link.leads !== 1 ? "es" : ""}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                <p className="flex-1 min-w-0 text-xs text-gray-600 truncate">{link.url}</p>
                <BotonCopiar texto={link.url} />
              </div>
              <button type="button" onClick={() => borrarLink(link.id)} disabled={isPending}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-60">
                Eliminar
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

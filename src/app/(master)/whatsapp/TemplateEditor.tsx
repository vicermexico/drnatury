"use client";

import { useState, useTransition } from "react";

interface Props {
  templateKey: string;
  label: string;
  description: string;
  body: string;
  availableVars: string[];
  updatedAt: string;
}

export function TemplateEditor({ templateKey, label, description, body, availableVars, updatedAt }: Props) {
  const [text, setText] = useState(body);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const isDirty = text !== body;

  function handleSave() {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await fetch(`/api/whatsapp-templates/${templateKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? "Error al guardar");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  function insertVar(v: string) {
    setText((prev) => prev + v);
  }

  const lastUpdated = new Date(updatedAt).toLocaleDateString("es-MX", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Monterrey",
  });

  return (
    <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
      >
        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
        <span className="text-gray-400 text-xs ml-4 shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
          {/* Variables disponibles */}
          {availableVars.length > 0 && (
            <div className="pt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Variables disponibles (clic para insertar)</p>
              <div className="flex flex-wrap gap-1.5">
                {availableVars.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVar(v)}
                    className="text-[11px] font-mono bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-100 transition"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Textarea */}
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setSaved(false); }}
            rows={8}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y"
          />

          {/* Footer: guardar + estado */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-400">Última edición: {lastUpdated}</p>
            <div className="flex items-center gap-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              {saved && <p className="text-xs text-green-600">Guardado</p>}
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending || !isDirty}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                {isPending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

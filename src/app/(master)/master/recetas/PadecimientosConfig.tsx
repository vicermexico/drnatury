"use client";
import { useState, useTransition } from "react";

interface Padecimiento {
  id: string;
  nombre: string;
  recomendacion: string;
  orden: number;
}

function PadecimientoItem({
  p,
  onSaved,
  onDeleted,
}: {
  p: Padecimiento;
  onSaved: (p: Padecimiento) => void;
  onDeleted: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState(p.nombre);
  const [recomendacion, setRecomendacion] = useState(p.recomendacion);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const isDirty = nombre !== p.nombre || recomendacion !== p.recomendacion;

  function handleSave() {
    setSaved(false);
    startTransition(async () => {
      const res = await fetch(`/api/padecimientos/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, recomendacion }),
      });
      if (!res.ok) return;
      const data = await res.json();
      onSaved(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  function handleDelete() {
    if (!confirm(`¿Eliminar "${p.nombre}"? Esto no afecta recetas ya mandadas.`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/padecimientos/${p.id}`, { method: "DELETE" });
      if (res.ok) onDeleted(p.id);
    });
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
      >
        <p className="text-sm font-semibold text-gray-900">{p.nombre}</p>
        <span className="text-gray-400 text-xs ml-4 shrink-0">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del padecimiento</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)}
              style={{ color: "black" }}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Recomendaciones (una por línea)
            </label>
            <textarea value={recomendacion} onChange={e => setRecomendacion(e.target.value)} rows={5}
              style={{ color: "black" }}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none resize-y" />
            <p className="text-xs text-gray-400 mt-1">
              Cada línea va a aparecer como una opción que el terapeuta puede marcar.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <button onClick={handleDelete} className="text-xs font-semibold text-red-500 hover:text-red-700">
              Eliminar
            </button>
            <div className="flex items-center gap-3">
              {saved && <p className="text-xs text-green-600">Guardado</p>}
              <button onClick={handleSave} disabled={isPending || !isDirty}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50">
                {isPending ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PadecimientosConfig({ initialPadecimientos }: { initialPadecimientos: Padecimiento[] }) {
  const [padecimientos, setPadecimientos] = useState(initialPadecimientos);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleAgregar() {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/padecimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, recomendacion: "" }),
      });
      if (!res.ok) { setError("No se pudo agregar"); return; }
      const data = await res.json();
      setPadecimientos(prev => [...prev, data]);
      setNuevoNombre("");
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-gray-200 p-4 flex gap-2">
        <input
          value={nuevoNombre}
          onChange={e => setNuevoNombre(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAgregar()}
          placeholder="Ej: Riñón"
          style={{ color: "black" }}
          className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none"
        />
        <button onClick={handleAgregar} disabled={isPending || !nuevoNombre.trim()}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50">
          + Agregar
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {padecimientos.length === 0 && (
        <p className="text-sm text-gray-400 px-1">Aún no das de alta ningún padecimiento.</p>
      )}
      <div className="space-y-3">
        {padecimientos.map(p => (
          <PadecimientoItem
            key={p.id}
            p={p}
            onSaved={updated => setPadecimientos(prev => prev.map(x => x.id === updated.id ? updated : x))}
            onDeleted={id => setPadecimientos(prev => prev.filter(x => x.id !== id))}
          />
        ))}
      </div>
    </div>
  );
}

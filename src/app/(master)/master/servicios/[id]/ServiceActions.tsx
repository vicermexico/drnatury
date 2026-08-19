"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  is_active: boolean;
  simultaneous_capacity: number;
}

const DURATION_OPTIONS = [30, 60, 90, 120, 150, 180];

function EditForm({ service, onCancel }: { service: Service; onCancel: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [name, setName] = useState(service.name);
  const [duration, setDuration] = useState(String(service.duration_minutes));
  const [isActive, setIsActive] = useState(service.is_active);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/services/${service.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            duration_minutes: parseInt(duration, 10),
            is_active: isActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.message ?? "Error al guardar"); return; }
        router.refresh();
        onCancel();
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div>
        <label className={lc}>Nombre del servicio</label>
        <input required value={name} onChange={e => setName(e.target.value)} className={ic} />
      </div>
      <div>
        <label className={lc}>Duracion</label>
        <select value={duration} onChange={e => setDuration(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
          {DURATION_OPTIONS.map(min => (
            <option key={min} value={min}>
              {min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}min` : ""}`}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" id="is_active" checked={isActive}
          onChange={e => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600" />
        <label htmlFor="is_active" className="text-sm text-gray-700 cursor-pointer">Servicio activo</label>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          Cancelar
        </button>
        <button type="submit" disabled={isPending}
          className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {isPending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

const lc = "block text-sm font-medium text-gray-700 mb-1";
const ic = "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

function DeleteButton({ serviceId, serviceName }: { serviceId: string; serviceName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/services/${serviceId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? "Error al eliminar");
        setConfirming(false);
        return;
      }
      router.push("/master/servicios");
    });
  }

  if (confirming) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-3">
        <p className="text-sm font-medium text-red-800">
          Eliminar <span className="font-bold">{serviceName}</span>?
        </p>
        <p className="text-xs text-red-600">El servicio dejara de aparecer en el catalogo y en el formulario de agenda.</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => setConfirming(false)}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-white transition">Cancelar</button>
          <button type="button" onClick={handleDelete} disabled={isPending}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-60">
            {isPending ? "Eliminando..." : "Si, eliminar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setConfirming(true)}
      className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition">
      Eliminar servicio
    </button>
  );
}

export function ServiceActions({ service }: { service: Service }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="space-y-3">
      {editing ? (
        <div className="rounded-2xl bg-white border border-blue-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Editar servicio</h2>
          <EditForm service={service} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition">
          Editar servicio
        </button>
      )}
      <DeleteButton serviceId={service.id} serviceName={service.name} />
    </div>
  );
}

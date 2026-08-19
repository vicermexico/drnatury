"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import type { WeeklySchedule, DaySchedule } from "@/types";

// â”€â”€ Tipos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface Branch {
  id: string;
  name: string;
  address: string;
  simultaneous_capacity: number;
  schedule: WeeklySchedule;
}

// â”€â”€ Horario â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DAYS: { key: keyof WeeklySchedule; label: string }[] = [
  { key: "monday",    label: "Lunes" },
  { key: "tuesday",   label: "Martes" },
  { key: "wednesday", label: "MiÃ©rcoles" },
  { key: "thursday",  label: "Jueves" },
  { key: "friday",    label: "Viernes" },
  { key: "saturday",  label: "SÃ¡bado" },
  { key: "sunday",    label: "Domingo" },
];

function DayRow({ label, value, onChange }: {
  label: string;
  value: DaySchedule;
  onChange: (v: DaySchedule) => void;
}) {
  const hasAfternoon = !!(value.afternoon_start || value.afternoon_end);
  return (
    <div className="border border-gray-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900 w-24">{label}</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={value.open}
            onChange={(e) => onChange({ ...value, open: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-blue-600" />
          <span className="text-sm text-gray-600">Abierto</span>
        </label>
      </div>
      {value.open && (
        <div className="space-y-1.5 pl-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-16 shrink-0">MaÃ±ana</span>
            <input type="time" value={value.morning_start ?? ""} onChange={(e) => onChange({ ...value, morning_start: e.target.value })} className={tc} />
            <span className="text-gray-400 text-xs">a</span>
            <input type="time" value={value.morning_end ?? ""} onChange={(e) => onChange({ ...value, morning_end: e.target.value })} className={tc} />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 w-16 shrink-0 cursor-pointer">
              <input type="checkbox" checked={hasAfternoon}
                onChange={(e) => onChange({ ...value, afternoon_start: e.target.checked ? "14:00" : undefined, afternoon_end: e.target.checked ? "18:00" : undefined })}
                className="h-3.5 w-3.5 rounded border-gray-300" />
              <span className="text-xs text-gray-500">Tarde</span>
            </label>
            {hasAfternoon && (
              <>
                <input type="time" value={value.afternoon_start ?? ""} onChange={(e) => onChange({ ...value, afternoon_start: e.target.value })} className={tc} />
                <span className="text-gray-400 text-xs">a</span>
                <input type="time" value={value.afternoon_end ?? ""} onChange={(e) => onChange({ ...value, afternoon_end: e.target.value })} className={tc} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
const tc = "rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none w-24";

// â”€â”€ EditForm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function EditForm({ branch, onCancel }: { branch: Branch; onCancel: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [name, setName] = useState(branch.name);
  const [address, setAddress] = useState(branch.address);
  const [schedule, setSchedule] = useState<WeeklySchedule>(branch.schedule ?? {});

  function setDay(key: keyof WeeklySchedule, value: DaySchedule) {
    setSchedule((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError("");

    startTransition(async () => {
      try {
        const res = await fetch(`/api/branches/${branch.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, address, schedule }),
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
    <form onSubmit={handleSubmit} className="space-y-5 pt-2">
      <div className="grid gap-4">
        <div>
          <label className={lc}>Nombre</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={ic} />
        </div>
        <div>
          <label className={lc}>DirecciÃ³n</label>
          <input required value={address} onChange={(e) => setAddress(e.target.value)} className={ic} />
        </div>
        <div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Horario</p>
        {DAYS.map(({ key, label }) => (
          <DayRow key={key} label={label}
            value={schedule[key] ?? { open: false }}
            onChange={(v) => setDay(key, v)} />
        ))}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          Cancelar
        </button>
        <button type="submit" disabled={isPending}
          className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {isPending ? "Guardandoâ€¦" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
const lc = "block text-sm font-medium text-gray-700 mb-1";
const ic = "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

// â”€â”€ DeleteButton â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DeleteButton({ branchId, branchName }: { branchId: string; branchName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/branches/${branchId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? "Error al eliminar");
        setConfirming(false);
        return;
      }
      router.push("/master/configuracion");
    });
  }

  if (confirming) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-3">
        <p className="text-sm font-medium text-red-800">
          Â¿Eliminar <span className="font-bold">{branchName}</span>?
        </p>
        <p className="text-xs text-red-600">
          Esta acciÃ³n es reversible desde la base de datos, pero la sucursal dejarÃ¡ de aparecer en la app.
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => setConfirming(false)}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-white transition">
            Cancelar
          </button>
          <button type="button" onClick={handleDelete} disabled={isPending}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-60">
            {isPending ? "Eliminandoâ€¦" : "SÃ­, eliminar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setConfirming(true)}
      className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition">
      Eliminar sucursal
    </button>
  );
}

// â”€â”€ Componente raÃ­z exportado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function BranchActions({ branch }: { branch: Branch }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-3">
      {editing ? (
        <div className="rounded-2xl bg-white border border-blue-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Editar sucursal</h2>
          <EditForm branch={branch} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          Editar sucursal
        </button>
      )}
      <DeleteButton branchId={branch.id} branchName={branch.name} />
    </div>
  );
}





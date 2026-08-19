"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import type { WeeklySchedule, DaySchedule } from "@/types";

const WEEKDAY_DEFAULT: DaySchedule = {
  open: true,
  morning_start: "10:00",
  morning_end: "13:00",
  afternoon_start: "14:00",
  afternoon_end: "18:00",
};
const WEEKEND_DEFAULT: DaySchedule = {
  open: true,
  morning_start: "10:00",
  morning_end: "14:00",
};

const DAYS: { key: keyof WeeklySchedule; label: string; default: DaySchedule }[] = [
  { key: "monday",    label: "Lunes",     default: WEEKDAY_DEFAULT },
  { key: "tuesday",   label: "Martes",    default: WEEKDAY_DEFAULT },
  { key: "wednesday", label: "MiÃ©rcoles", default: WEEKDAY_DEFAULT },
  { key: "thursday",  label: "Jueves",    default: WEEKDAY_DEFAULT },
  { key: "friday",    label: "Viernes",   default: WEEKDAY_DEFAULT },
  { key: "saturday",  label: "SÃ¡bado",    default: WEEKEND_DEFAULT },
  { key: "sunday",    label: "Domingo",   default: { open: false } },
];

const DEFAULT_SCHEDULE: WeeklySchedule = Object.fromEntries(
  DAYS.map(({ key, default: d }) => [key, { ...d }])
) as WeeklySchedule;

function DayRow({ label, value, onChange }: { label: string; value: DaySchedule; onChange: (v: DaySchedule) => void }) {
  const hasAfternoon = !!(value.afternoon_start || value.afternoon_end);
  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
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
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-16 shrink-0">MaÃ±ana</span>
            <input type="time" value={value.morning_start ?? ""}
              onChange={(e) => onChange({ ...value, morning_start: e.target.value })}
              className={timeInputClass} />
            <span className="text-gray-400 text-xs">a</span>
            <input type="time" value={value.morning_end ?? ""}
              onChange={(e) => onChange({ ...value, morning_end: e.target.value })}
              className={timeInputClass} />
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
                <input type="time" value={value.afternoon_start ?? ""}
                  onChange={(e) => onChange({ ...value, afternoon_start: e.target.value })}
                  className={timeInputClass} />
                <span className="text-gray-400 text-xs">a</span>
                <input type="time" value={value.afternoon_end ?? ""}
                  onChange={(e) => onChange({ ...value, afternoon_end: e.target.value })}
                  className={timeInputClass} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function BranchForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const submitting = useRef(false);

  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [colonia, setColonia] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [estado, setEstado] = useState("Nuevo LeÃ³n");
  const [cp, setCp] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [schedule, setSchedule] = useState<WeeklySchedule>(DEFAULT_SCHEDULE);

  function setDay(key: keyof WeeklySchedule, value: DaySchedule) {
    setSchedule((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError("");

    const address = [street, colonia, municipio, estado, cp].filter(Boolean).join(", ");

    startTransition(async () => {
      try {
        const res = await fetch("/api/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            address,
            street,
            colonia,
            municipio,
            estado,
            cp,
            lat: lat ? parseFloat(lat) : undefined,
            lng: lng ? parseFloat(lng) : undefined,
            schedule,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.message ?? "Error al guardar la sucursal"); return; }
        router.push(`/master/sucursales/${data.id}`);
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Datos bÃ¡sicos</h2>

        <div>
          <label className={labelClass}>Nombre de la sucursal *</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Ej: San NicolÃ¡s" className={inputClass} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">DirecciÃ³n</h2>

        <div>
          <label className={labelClass}>Calle y nÃºmero *</label>
          <input type="text" required value={street} onChange={(e) => setStreet(e.target.value)}
            placeholder="Ej: Av. Lincoln 123" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Colonia *</label>
          <input type="text" required value={colonia} onChange={(e) => setColonia(e.target.value)}
            placeholder="Ej: Del Valle" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Municipio *</label>
          <input type="text" required value={municipio} onChange={(e) => setMunicipio(e.target.value)}
            placeholder="Ej: San NicolÃ¡s de los Garza" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Estado</label>
          <input type="text" value={estado} onChange={(e) => setEstado(e.target.value)}
            placeholder="Ej: Nuevo LeÃ³n" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>CÃ³digo Postal</label>
          <input type="text" value={cp} onChange={(e) => setCp(e.target.value)}
            placeholder="Ej: 66480" className={inputClass} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">UbicaciÃ³n en mapa</h2>
        <p className="text-xs text-gray-400">Opcional â€” para el botÃ³n de Google Maps en la app del paciente</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Latitud</label>
            <input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)}
              placeholder="Ej: 25.6866" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Longitud</label>
            <input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)}
              placeholder="Ej: -100.3161" className={inputClass} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs text-gray-400 mb-1">NÃºmero de personas atendidas al mismo tiempo</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Horario de atenciÃ³n</h2>
        {DAYS.map(({ key, label }) => (
          <DayRow key={key} label={label} value={schedule[key] ?? { open: false }}
            onChange={(v) => setDay(key, v)} />
        ))}
      </section>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()}
          className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          Cancelar
        </button>
        <button type="submit" disabled={isPending}
          className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {isPending ? "Guardandoâ€¦" : "Guardar sucursal"}
        </button>
      </div>
    </form>
  );
}

const labelClass = "block text-sm font-medium text-gray-700 mb-1";
const inputClass = "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
const timeInputClass = "rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none w-24";


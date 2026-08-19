"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCSTTime, formatCSTDateShort } from "@/lib/appointments/availability";

interface Slot { starts_at: string; ends_at: string; }
type Step = "idle" | "date" | "time" | "confirm";

const DAY_KEYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;
const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
] as const;
const DAY_LABELS = ["Do","Lu","Ma","Mi","Ju","Vi","Sa"] as const;

function todayCST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
}
function generateCalendarDays(year: number, month: number): string[] {
  const days: string[] = [];
  const n = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= n; d++) {
    days.push(`${year}-${String(month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
  }
  return days;
}

function DatePicker({
  initialDate,
  onSelect,
  onCancel,
}: {
  initialDate: string;
  onSelect: (d: string) => void;
  onCancel: () => void;
}) {
  const today = todayCST();
  const initYear  = parseInt(initialDate.split("-")[0], 10);
  const initMonth = parseInt(initialDate.split("-")[1], 10) - 1;
  const [year, setYear]   = useState(initYear);
  const [month, setMonth] = useState(initMonth);

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 60);
  const maxStr = maxDate.toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });

  const days     = generateCalendarDays(year, month);
  const firstDay = new Date(year, month, 1).getDay();

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Elige nueva fecha</p>
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 text-gray-400 hover:text-gray-700 transition">←</button>
        <p className="text-sm font-semibold text-gray-800 capitalize">
          {MONTH_NAMES[month]} {year}
        </p>
        <button onClick={nextMonth} className="p-2 text-gray-400 hover:text-gray-700 transition">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAY_LABELS.map(d => (
          <p key={d} className="text-[11px] text-gray-400 font-medium pb-1">{d}</p>
        ))}
        {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
        {days.map(dateStr => {
          const disabled = dateStr <= today || dateStr > maxStr;
          const dayNum = parseInt(dateStr.split("-")[2], 10);
          return (
            <button
              key={dateStr}
              disabled={disabled}
              onClick={() => onSelect(dateStr)}
              className={[
                "rounded-lg py-2 text-sm transition",
                disabled
                  ? "text-gray-300 cursor-default"
                  : "text-gray-900 font-medium hover:bg-blue-50 hover:text-blue-700",
              ].join(" ")}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
      <button onClick={onCancel} className="w-full text-sm text-gray-400 hover:text-gray-600 py-1.5 transition">
        Cancelar
      </button>
    </div>
  );
}

function TimePicker({
  branchId,
  serviceId,
  dateStr,
  onSelect,
  onBack,
}: {
  branchId: string;
  serviceId: string;
  dateStr: string;
  onSelect: (s: Slot) => void;
  onBack: () => void;
}) {
  const [slots, setSlots]   = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false); setSlots([]);
    fetch(`/api/appointments/availability?branch_id=${branchId}&service_id=${serviceId}&date=${dateStr}`)
      .then(async res => {
        if (!res.ok) { if (!cancelled) setError(true); return; }
        const data = await res.json() as unknown;
        if (!cancelled) setSlots(Array.isArray(data) ? data as Slot[] : []);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [branchId, serviceId, dateStr]);

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Elige nueva hora — {formatCSTDateShort(new Date(dateStr + "T12:00:00").toISOString())}
      </p>
      {loading && <p className="text-sm text-gray-400 text-center py-4">Cargando horarios…</p>}
      {error   && <p className="text-sm text-red-500 text-center py-4">Error cargando horarios.</p>}
      {!loading && !error && slots.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">No hay horarios disponibles este día.</p>
      )}
      {!loading && !error && slots.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {slots.map(slot => (
            <button
              key={slot.starts_at}
              onClick={() => onSelect(slot)}
              className="rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-800 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition"
            >
              {formatCSTTime(slot.starts_at)}
            </button>
          ))}
        </div>
      )}
      <button onClick={onBack} className="w-full text-sm text-gray-400 hover:text-gray-600 py-1.5 transition">
        ← Cambiar fecha
      </button>
    </div>
  );
}

function ConfirmReschedule({
  slot,
  onConfirm,
  onBack,
  isPending,
  error,
}: {
  slot: Slot;
  onConfirm: () => void;
  onBack: () => void;
  isPending: boolean;
  error: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Confirmar cambio</p>
      <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 space-y-0.5">
        <p className="text-base font-bold text-gray-900">{formatCSTTime(slot.starts_at)}</p>
        <p className="text-sm font-medium text-gray-700">{formatCSTDateShort(slot.starts_at)}</p>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>}
      <button
        onClick={onConfirm}
        disabled={isPending}
        className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60"
      >
        {isPending ? "Reagendando…" : "Confirmar reagendado"}
      </button>
      <button onClick={onBack} className="w-full text-sm text-gray-400 hover:text-gray-600 py-1.5 transition">
        ← Cambiar hora
      </button>
    </div>
  );
}

export function RescheduleButton({
  appointmentId,
  branchId,
  serviceId,
  currentStartsAt,
}: {
  appointmentId: string;
  branchId: string;
  serviceId: string;
  currentStartsAt: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep]   = useState<Step>("idle");
  const [dateStr, setDateStr] = useState("");
  const [slot, setSlot]   = useState<Slot | null>(null);
  const [error, setError] = useState("");

  const initDate = new Date(currentStartsAt)
    .toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });

  function handleConfirm() {
    if (!slot) return;
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starts_at: slot.starts_at, ends_at: slot.ends_at }),
      });
      const data = await res.json() as { error?: string; message?: string };
      if (res.status === 409) {
        setError("Ese horario ya fue tomado. Elige otro.");
        setStep("time");
        return;
      }
      if (!res.ok) {
        setError(data.message ?? "Error al reagendar. Intenta de nuevo.");
        return;
      }
      setStep("idle");
      router.refresh();
    });
  }

  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("date")}
        className="text-xs font-semibold text-gray-700 transition hover:text-gray-900 text-center leading-tight w-full"
      >
        Reagendar
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-blue-100 bg-white p-4">
      {step === "date" && (
        <DatePicker
          initialDate={initDate}
          onSelect={d => { setDateStr(d); setSlot(null); setError(""); setStep("time"); }}
          onCancel={() => setStep("idle")}
        />
      )}
      {step === "time" && (
        <TimePicker
          branchId={branchId}
          serviceId={serviceId}
          dateStr={dateStr}
          onSelect={s => { setSlot(s); setError(""); setStep("confirm"); }}
          onBack={() => setStep("date")}
        />
      )}
      {step === "confirm" && slot && (
        <ConfirmReschedule
          slot={slot}
          onConfirm={handleConfirm}
          onBack={() => setStep("time")}
          isPending={isPending}
          error={error}
        />
      )}
    </div>
  );
}

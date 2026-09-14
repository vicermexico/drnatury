"use client";

import { useState, useEffect, useTransition } from "react";
import { formatCSTTime } from "@/lib/appointments/availability";

interface Slot { starts_at: string; ends_at: string }
type Schedule = Record<string, { open: boolean }> | null;
type View = "menu" | "reagendar-fecha" | "reagendar-hora" | "done";
type DoneType = "confirmed" | "cancelled" | "rescheduled";

interface Props {
  appointmentId: string;
  token: string;
  currentStatus: string;
  branchId: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  branchSchedule: Schedule;
  branchName: string;
  branchAddress: string;
  modalidad: "CONSULTORIO" | "DOMICILIO";
  therapistId: string | null;
  therapistWhatsapp: string | null;
}

const DAY_KEYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;

function isBranchOpenOnDate(schedule: Schedule, dateStr: string): boolean {
  if (!schedule) return true; // domicilio no depende de horario de sucursal
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dayIdx = new Date(Date.UTC(y, mo - 1, d, 12, 0)).getUTCDay();
  return !!(schedule[DAY_KEYS[dayIdx]]?.open);
}
function generateCalendarDays(year: number, month: number): string[] {
  const days: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) days.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return days;
}
function todayCST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
}
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function buildTherapistWaUrl(waNumber: string, mensaje: string): string {
  const digits = waNumber.replace(/\D/g, "");
  const waPhone = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(mensaje)}`;
}

export function ConfirmActions({
  appointmentId, token, currentStatus,
  branchId, serviceId, durationMinutes, branchSchedule,
  modalidad, therapistId, therapistWhatsapp,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<View>("menu");
  const [doneType, setDoneType] = useState<DoneType | null>(null);
  const [error, setError] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [newSlot, setNewSlot] = useState<Slot | null>(null);

  async function act(status: "CONFIRMADA" | "CANCELADA") {
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, confirm_token: token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Error al procesar. Intenta de nuevo.");
        return;
      }
      setDoneType(status === "CONFIRMADA" ? "confirmed" : "cancelled");
      setView("done");
    });
  }

  function elegirSlot(slot: Slot) {
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starts_at: slot.starts_at, ends_at: slot.ends_at, confirm_token: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) { setError("Ese horario ya no está disponible. Elige otro."); return; }
      if (!res.ok) { setError(data.message ?? "Error al reagendar. Intenta de nuevo."); return; }
      setNewSlot(slot);
      setDoneType("rescheduled");
      setView("done");
    });
  }

  function buildFinalMensaje(): string {
    if (doneType === "confirmed") return "Ya confirmé mi cita, en un rato nos vemos";
    if (doneType === "cancelled") return "Lo siento, he cancelado mi cita, luego me pongo en contacto con ustedes para reagendar más adelante";
    if (doneType === "rescheduled" && newSlot) {
      const fechaLabel = capitalize(new Date(newSlot.starts_at).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Monterrey" }));
      return `Les acabo de reagendar, se me complicó para asistir hoy pero Primero Dios nos vemos el próximo ${fechaLabel} a las ${formatCSTTime(newSlot.starts_at)}`;
    }
    return "";
  }

  if (view === "done" && doneType) {
    const META: Record<DoneType, { emoji: string; bg: string; border: string; text: string; title: string; sub: string }> = {
      confirmed:   { emoji: "✅", bg: "bg-green-50", border: "border-green-200", text: "text-green-800", title: "Cita confirmada",  sub: "Te esperamos. Recibirás recordatorios por WhatsApp." },
      cancelled:   { emoji: "❌", bg: "bg-gray-50",  border: "border-gray-200",  text: "text-gray-700",  title: "Cita cancelada",   sub: "Cuando quieras reagendar, contáctanos." },
      rescheduled: { emoji: "🔄", bg: "bg-blue-50",  border: "border-blue-200",  text: "text-blue-800",  title: "Cita reagendada",  sub: newSlot ? `Nuevo horario: ${capitalize(new Date(newSlot.starts_at).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Monterrey" }))} a las ${formatCSTTime(newSlot.starts_at)}` : "" },
    };
    const m = META[doneType];
    return (
      <div className="space-y-3">
        <div className={`rounded-2xl ${m.bg} border ${m.border} p-6 text-center space-y-2`}>
          <p className="text-2xl">{m.emoji}</p>
          <p className={`font-semibold ${m.text}`}>{m.title}</p>
          <p className="text-sm text-gray-500">{m.sub}</p>
        </div>
        {therapistWhatsapp && (
          <a
            href={buildTherapistWaUrl(therapistWhatsapp, buildFinalMensaje())}
            className="block w-full rounded-xl bg-green-500 py-3 text-sm font-semibold text-white text-center hover:bg-green-600 transition"
          >
            Finalizar
          </a>
        )}
      </div>
    );
  }

  if (view === "reagendar-fecha") {
    return (
      <FechaPicker
        schedule={branchSchedule}
        onSelect={d => { setDateStr(d); setView("reagendar-hora"); }}
        onBack={() => setView("menu")}
      />
    );
  }

  if (view === "reagendar-hora") {
    return (
      <HorarioPicker
        branchId={branchId} serviceId={serviceId} dateStr={dateStr} modalidad={modalidad} therapistId={therapistId}
        isPending={isPending} error={error}
        onSelect={elegirSlot}
        onBack={() => setView("reagendar-fecha")}
      />
    );
  }

  return (
    <div className="space-y-3">
      {currentStatus === "PENDIENTE" && (
        <p className="text-sm text-center text-gray-500">
          ¿Confirmas tu asistencia?
        </p>
      )}

      <button
        onClick={() => act("CONFIRMADA")}
        disabled={isPending || currentStatus === "CONFIRMADA"}
        className={[
          "w-full rounded-xl py-3 text-sm font-semibold transition disabled:opacity-60",
          currentStatus === "CONFIRMADA"
            ? "bg-green-100 text-green-700 cursor-default"
            : "bg-green-600 text-white hover:bg-green-700",
        ].join(" ")}
      >
        {currentStatus === "CONFIRMADA" ? "✓ Ya confirmada" : isPending ? "…" : "Confirmar asistencia"}
      </button>

      <button
        onClick={() => setView("reagendar-fecha")}
        disabled={isPending}
        className="w-full rounded-xl border border-blue-200 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition disabled:opacity-60"
      >
        Reagendar cita
      </button>

      <button
        onClick={() => act("CANCELADA")}
        disabled={isPending}
        className="w-full rounded-xl border border-red-200 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-60"
      >
        Cancelar cita
      </button>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────
function BackButton({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition">← Volver</button>;
}

function FechaPicker({ schedule, onSelect, onBack }: { schedule: Schedule; onSelect: (d: string) => void; onBack: () => void }) {
  const today = todayCST();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const days = generateCalendarDays(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 30);
  const maxStr = maxDate.toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
  const monthName = new Date(year, month, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700 text-center">Elige la nueva fecha</p>
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 text-gray-500 hover:text-gray-900">←</button>
        <p className="text-sm font-semibold capitalize">{monthName}</p>
        <button onClick={nextMonth} className="p-2 text-gray-500 hover:text-gray-900">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Do","Lu","Ma","Mi","Ju","Vi","Sa"].map(d => <p key={d} className="text-[11px] text-gray-400 font-medium pb-1">{d}</p>)}
        {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
        {days.map(dateStr => {
          const isPast = dateStr < today;
          const isFuture = dateStr > maxStr;
          const closed = !isBranchOpenOnDate(schedule, dateStr);
          const disabled = isPast || isFuture || closed;
          const dayNum = parseInt(dateStr.split("-")[2], 10);
          return (
            <button key={dateStr} disabled={disabled} onClick={() => onSelect(dateStr)}
              className={["rounded-lg py-2 text-sm transition",
                disabled ? "text-gray-300 cursor-default" : "text-gray-900 hover:bg-emerald-50 hover:text-emerald-700 font-medium",
                dateStr === today && !disabled ? "ring-2 ring-emerald-500" : ""].join(" ")}>
              {dayNum}
            </button>
          );
        })}
      </div>
      <BackButton onClick={onBack} />
    </div>
  );
}

function HorarioPicker({
  branchId, serviceId, dateStr, modalidad, therapistId, isPending, error, onSelect, onBack,
}: {
  branchId: string; serviceId: string; dateStr: string; modalidad: "CONSULTORIO" | "DOMICILIO"; therapistId: string | null;
  isPending: boolean; error: string;
  onSelect: (s: Slot) => void; onBack: () => void;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(false); setSlots([]);
    const qs = modalidad === "DOMICILIO"
      ? `service_id=${serviceId}&date=${dateStr}&modalidad=DOMICILIO${therapistId ? `&therapist_id=${therapistId}` : ""}`
      : `branch_id=${branchId}&service_id=${serviceId}&date=${dateStr}`;
    fetch(`/api/appointments/availability?${qs}`)
      .then(async res => {
        if (!res.ok) { if (!cancelled) setErr(true); return; }
        const data = await res.json();
        if (!cancelled) setSlots(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (!cancelled) setErr(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [branchId, serviceId, dateStr, modalidad, therapistId]);

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700 text-center">Elige la nueva hora</p>
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Cargando horarios…</p>
      ) : err ? (
        <p className="text-sm text-red-500 text-center py-8">Error cargando horarios. Intenta de nuevo.</p>
      ) : slots.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No hay horarios disponibles para este día.<br />Elige otra fecha.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot: Slot) => (
            <button key={slot.starts_at} onClick={() => onSelect(slot)} disabled={isPending}
              className="rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 transition disabled:opacity-60">
              {formatCSTTime(slot.starts_at)}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      <BackButton onClick={onBack} />
    </div>
  );
}

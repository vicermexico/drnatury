"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCSTTime } from "@/lib/appointments/availability";
import type { AppointmentStatus } from "@/types";

interface Slot { starts_at: string; ends_at: string }

// ── Cambio de estado ──────────────────────────────────────────

const TRANSITIONS: Partial<Record<AppointmentStatus, {
  status: AppointmentStatus; label: string; variant: "blue" | "green" | "orange" | "red"
}[]>> = {
  PENDIENTE: [
    { status: "CONFIRMADA", label: "Confirmar cita",    variant: "blue"   },
    { status: "CANCELADA",  label: "Cancelar cita",     variant: "red"    },
  ],
  CONFIRMADA: [
    { status: "COMPLETADA", label: "Marcar completada", variant: "green"  },
    { status: "NO_ASISTIO", label: "No asistió",        variant: "orange" },
    { status: "CANCELADA",  label: "Cancelar cita",     variant: "red"    },
  ],
};

const VARIANT_CLASS = {
  blue:   "bg-blue-600 hover:bg-blue-700 text-white",
  green:  "bg-green-600 hover:bg-green-700 text-white",
  orange: "bg-orange-500 hover:bg-orange-600 text-white",
  red:    "border border-red-200 text-red-600 hover:bg-red-50",
};

const RESCHEDULABLE: AppointmentStatus[] = ["PENDIENTE", "CONFIRMADA"];

// ── Formulario de reagendado ──────────────────────────────────

function RescheduleForm({
  appointmentId, branchId, serviceId, onCancel, onSuccess,
}: {
  appointmentId: string;
  branchId:      string;
  serviceId:     string;
  onCancel:      () => void;
  onSuccess:     () => void;
}) {
  const todayCst = new Date().toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
  const maxDate  = new Date(Date.now() + 30 * 86_400_000)
    .toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });

  const [date,         setDate]         = useState("");
  const [slots,        setSlots]        = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [isPending,    startTransition] = useTransition();
  const [error,        setError]        = useState("");

  useEffect(() => {
    if (!date) { setSlots([]); setSelectedSlot(null); return; }
    setLoadingSlots(true);
    setSelectedSlot(null);
    fetch(`/api/appointments/availability?branch_id=${branchId}&service_id=${serviceId}&date=${date}`)
      .then((r) => r.json())
      .then((data: Slot[]) => setSlots(Array.isArray(data) ? data : []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [date, branchId, serviceId]);

  function handleSubmit() {
    if (!selectedSlot) return;
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starts_at: selectedSlot.starts_at, ends_at: selectedSlot.ends_at }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Error al reagendar"); return; }
      onSuccess();
    });
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-white p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Reagendar cita</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nueva fecha</label>
        <input type="date" value={date} min={todayCst} max={maxDate}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
      </div>

      {date && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nuevo horario</label>
          {loadingSlots ? (
            <div className="flex items-center gap-2 py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <span className="text-sm text-gray-400">Buscando horarios…</span>
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-gray-400">Sin horarios disponibles para esta fecha.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => {
                const active = selectedSlot?.starts_at === slot.starts_at;
                return (
                  <button key={slot.starts_at} type="button"
                    onClick={() => setSelectedSlot(active ? null : slot)}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition border ${
                      active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                    }`}>
                    {formatCSTTime(slot.starts_at)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          Cancelar
        </button>
        <button type="button" onClick={handleSubmit}
          disabled={!selectedSlot || isPending}
          className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {isPending ? "Guardando…" : "Confirmar cambio"}
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────

export function AppointmentActions({
  appointmentId,
  currentStatus,
  branchId,
  serviceId,
}: {
  appointmentId: string;
  currentStatus: AppointmentStatus;
  branchId:      string;
  serviceId:     string;
}) {
  const router = useRouter();
  const [isPending,   startTransition] = useTransition();
  const [error,       setError]        = useState("");
  const [confirming,  setConfirming]   = useState<AppointmentStatus | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  const actions = TRANSITIONS[currentStatus];
  const canReschedule = RESCHEDULABLE.includes(currentStatus);

  function handleAction(newStatus: AppointmentStatus) {
    if (newStatus === "CANCELADA" && confirming !== "CANCELADA") {
      setConfirming("CANCELADA");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Error al actualizar el estado");
        setConfirming(null);
        return;
      }
      router.refresh();
      setConfirming(null);
    });
  }

  // Pantalla de confirmación de cancelación
  if (confirming === "CANCELADA") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-3">
        <p className="text-sm font-medium text-red-800">¿Confirmas la cancelación de esta cita?</p>
        <p className="text-xs text-red-600">Se enviará un WhatsApp de notificación al paciente y a la terapeuta.</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => setConfirming(null)}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-white transition">
            No cancelar
          </button>
          <button type="button" onClick={() => handleAction("CANCELADA")} disabled={isPending}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-60">
            {isPending ? "Cancelando…" : "Sí, cancelar"}
          </button>
        </div>
      </div>
    );
  }

  // Formulario de reagendado
  if (rescheduling) {
    return (
      <RescheduleForm
        appointmentId={appointmentId}
        branchId={branchId}
        serviceId={serviceId}
        onCancel={() => setRescheduling(false)}
        onSuccess={() => { setRescheduling(false); router.refresh(); }}
      />
    );
  }

  if (!actions?.length && !canReschedule) return null;

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

      {/* Botón de reagendar */}
      {canReschedule && (
        <button type="button" onClick={() => setRescheduling(true)}
          className="w-full rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          Reagendar cita
        </button>
      )}

      {/* Botones de cambio de estado */}
      {actions?.map((action) => (
        <button key={action.status} type="button"
          onClick={() => handleAction(action.status)}
          disabled={isPending}
          className={`w-full rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-60 ${VARIANT_CLASS[action.variant]}`}>
          {isPending ? "Actualizando…" : action.label}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCSTTime } from "@/lib/appointments/availability";
import type { AppointmentStatus } from "@/types";

interface Slot { starts_at: string; ends_at: string }

const TERAPEUTA_ACTIONS: Partial<Record<AppointmentStatus, {
  status: AppointmentStatus;
  label: string;
  className: string;
}[]>> = {
  PENDIENTE: [
    { status: "CANCELADA", label: "Cancelar cita", className: "border border-red-200 text-red-600 hover:bg-red-50" },
  ],
  CONFIRMADA: [
    { status: "COMPLETADA", label: "Marcar completada",  className: "bg-green-600 hover:bg-green-700 text-white" },
    { status: "NO_ASISTIO", label: "Paciente no asistió", className: "bg-orange-500 hover:bg-orange-600 text-white" },
    { status: "CANCELADA",  label: "Cancelar cita",       className: "border border-red-200 text-red-600 hover:bg-red-50" },
  ],
};

const RESCHEDULABLE: AppointmentStatus[] = ["PENDIENTE", "CONFIRMADA"];

function RescheduleForm({ appointmentId, onCancel, onSuccess }: {
  appointmentId: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const todayCst = new Date().toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
  const maxDate  = new Date(Date.now() + 30 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });

  const [date,         setDate]         = useState("");
  const [slots,        setSlots]        = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [isPending,    startTransition] = useTransition();
  const [error,        setError]        = useState("");
  const [branchId,     setBranchId]     = useState("");
  const [serviceId,    setServiceId]    = useState("");

  useEffect(() => {
    fetch(`/api/appointments/${appointmentId}`)
      .then(r => r.json())
      .then(d => { setBranchId(d.branch_id ?? ""); setServiceId(d.service_id ?? ""); })
      .catch(() => {});
  }, [appointmentId]);

  useEffect(() => {
    if (!date || !branchId || !serviceId) { setSlots([]); setSelectedSlot(null); return; }
    setLoadingSlots(true);
    setSelectedSlot(null);
    fetch(`/api/appointments/availability?branch_id=${branchId}&service_id=${serviceId}&date=${date}`)
      .then(r => r.json())
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
            <p className="text-sm text-gray-400">Sin horarios disponibles.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => {
                const active = selectedSlot?.starts_at === slot.starts_at;
                return (
                  <button key={slot.starts_at} type="button"
                    onClick={() => setSelectedSlot(active ? null : slot)}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition border ${
                      active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
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

export function TerapeutaActions({ appointmentId, currentStatus }: {
  appointmentId: string;
  currentStatus: AppointmentStatus;
}) {
  const router = useRouter();
  const [isPending,    startTransition] = useTransition();
  const [confirming,   setConfirming]   = useState<AppointmentStatus | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [error,        setError]        = useState("");

  const actions      = TERAPEUTA_ACTIONS[currentStatus];
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
      const data = await res.json() as { message?: string };
      if (!res.ok) { setError(data.message ?? "Error al actualizar."); setConfirming(null); return; }
      setConfirming(null);
      router.refresh();
    });
  }

  if (confirming === "CANCELADA") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-3">
        <p className="text-sm font-medium text-red-800">¿Confirmas la cancelación de esta cita?</p>
        <p className="text-xs text-red-600">Se enviará notificación al paciente.</p>
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

  if (rescheduling) {
    return (
      <RescheduleForm
        appointmentId={appointmentId}
        onCancel={() => setRescheduling(false)}
        onSuccess={() => { setRescheduling(false); router.refresh(); }}
      />
    );
  }

  const done: Record<string, string> = {
    COMPLETADA: "Esta cita fue marcada como completada.",
    NO_ASISTIO: "Esta cita fue marcada como no asistida.",
    CANCELADA:  "Esta cita fue cancelada.",
  };
  if (!actions?.length && !canReschedule) {
    const msg = done[currentStatus];
    if (msg) return <p className="text-sm text-gray-400 text-center py-2">{msg}</p>;
    return null;
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}
      {canReschedule && (
        <button type="button" onClick={() => setRescheduling(true)}
          className="w-full rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          Reagendar cita
        </button>
      )}
      {actions?.map(action => (
        <button key={action.status} type="button"
          onClick={() => handleAction(action.status)}
          disabled={isPending}
          className={`w-full rounded-xl py-3 text-sm font-semibold transition disabled:opacity-60 ${action.className}`}>
          {action.label}
        </button>
      ))}
    </div>
  );
}

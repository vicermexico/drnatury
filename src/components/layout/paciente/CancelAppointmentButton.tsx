"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function CancelAppointmentButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleCancel() {
    if (!window.confirm("¿Seguro que quieres cancelar esta cita?")) return;
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELADA" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        setError(data.message ?? "No se pudo cancelar. Intenta de nuevo.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <button
        onClick={handleCancel}
        disabled={isPending}
        className="text-xs font-semibold text-gray-700 disabled:opacity-50 transition hover:text-gray-900"
      >
        {isPending ? "Cancelando…" : "Cancelar cita"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

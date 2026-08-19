"use client";

import { useState, useTransition } from "react";

interface Props {
  appointmentId: string;
  token: string;
  currentStatus: string;
}

export function ConfirmActions({ appointmentId, token, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<"confirmed" | "cancelled" | null>(null);
  const [error, setError] = useState("");

  async function act(status: "CONFIRMADA" | "CANCELADA") {
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, confirm_token: token }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? "Error al procesar. Intenta de nuevo.");
        return;
      }
      setDone(status === "CONFIRMADA" ? "confirmed" : "cancelled");
    });
  }

  if (done === "confirmed") {
    return (
      <div className="rounded-2xl bg-green-50 border border-green-200 p-6 text-center space-y-2">
        <p className="text-2xl">✅</p>
        <p className="font-semibold text-green-800">¡Cita confirmada!</p>
        <p className="text-sm text-green-600">Te esperamos. Recibirás recordatorios por WhatsApp.</p>
      </div>
    );
  }

  if (done === "cancelled") {
    return (
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-6 text-center space-y-2">
        <p className="text-2xl">❌</p>
        <p className="font-semibold text-gray-700">Cita cancelada</p>
        <p className="text-sm text-gray-500">
          <a href="/login" className="text-blue-600 underline">
            Agendar una nueva cita
          </a>
        </p>
      </div>
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

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Opciones comunes en horas:minutos -- Vic pidio poder bajarlo a 1:30 hrs
// (90 min, que era el valor fijo de antes), pero se deja un rango de
// opciones para que tambien pueda subirlo o bajarlo mas si hace falta.
const OPCIONES = [30, 45, 60, 75, 90, 105, 120, 150, 180];

function formatoHoras(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h}:${String(m).padStart(2, "0")} hrs` : `${h} hrs`;
}

export function TiempoExtraForm({ valorInicial }: { valorInicial: number }) {
  const router = useRouter();
  const [valor, setValor] = useState(String(valorInicial));
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  function guardar() {
    setStatus("idle");
    startTransition(async () => {
      const res = await fetch("/api/master/domicilio-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extra_minutes: Number(valor) }),
      });
      setStatus(res.ok ? "ok" : "error");
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <select
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        {OPCIONES.map((min) => (
          <option key={min} value={min}>{formatoHoras(min)}</option>
        ))}
      </select>
      {status === "ok" && <p className="text-sm text-green-600 font-medium">Guardado correctamente</p>}
      {status === "error" && <p className="text-sm text-red-600">Error al guardar</p>}
      <button
        type="button"
        onClick={guardar}
        disabled={isPending}
        className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60"
      >
        {isPending ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}

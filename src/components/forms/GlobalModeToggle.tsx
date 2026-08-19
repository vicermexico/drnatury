"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  branchId: string;
  globalMode: boolean;
  globalCapacity: number;
}

export function GlobalModeToggle({ branchId, globalMode, globalCapacity }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState(globalMode);
  const [capacity, setCapacity] = useState(String(globalCapacity));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function handleToggle() {
    setMode(prev => !prev);
    setSaved(false);
  }

  function handleCapacity(n: number) {
    setCapacity(String(n));
    setSaved(false);
  }

  function handleSave() {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ global_mode: mode, global_capacity: parseInt(capacity, 10) }),
      });
      if (!res.ok) { setError("Error al guardar"); return; }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Modo Global</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {mode
              ? "Todos los servicios comparten horario y capacidad global"
              : "Cada servicio usa su propia capacidad y horario independiente"}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={isPending}
          className={[
            "relative inline-flex h-7 w-14 items-center rounded-full transition-colors disabled:opacity-60",
            mode ? "bg-blue-600" : "bg-gray-300",
          ].join(" ")}
        >
          <span className={[
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            mode ? "translate-x-8" : "translate-x-1",
          ].join(" ")} />
        </button>
      </div>

      {mode && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Capacidad global por horario
          </label>
          <div className="flex gap-2 items-center">
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => handleCapacity(n)}
                disabled={isPending}
                className={[
                  "w-10 h-10 rounded-xl text-sm font-semibold border-2 transition",
                  String(n) === capacity ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300",
                ].join(" ")}
              >
                x{n}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Si esta en x2, cualquier servicio se puede agendar 2 veces al mismo tiempo en esta sucursal.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">✓ Guardado correctamente</p>}

      <button
        onClick={handleSave}
        disabled={isPending}
        className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60"
      >
        {isPending ? "Guardando..." : "Guardar modo global"}
      </button>
    </div>
  );
}

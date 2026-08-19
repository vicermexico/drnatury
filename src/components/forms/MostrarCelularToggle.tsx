"use client";
import { useState, useTransition } from "react";

interface Props {
  branchId: string;
  mostrarCelular: boolean;
}

export function MostrarCelularToggle({ branchId, mostrarCelular: initial }: Props) {
  const [value, setValue] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function handleToggle() {
    const newValue = !value;
    setValue(newValue);
    setError(""); setSaved(false);
    startTransition(async () => {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mostrar_celular: newValue }),
      });
      if (!res.ok) { setError("Error al guardar"); setValue(!newValue); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Mostrar celular del paciente</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {value
              ? "Las terapeutas pueden ver el celular del paciente"
              : "Las terapeutas NO ven el celular del paciente"}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={isPending}
          className={[
            "relative inline-flex h-7 w-14 items-center rounded-full transition-colors disabled:opacity-60",
            value ? "bg-blue-600" : "bg-gray-300",
          ].join(" ")}
        >
          <span className={[
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            value ? "translate-x-8" : "translate-x-1",
          ].join(" ")} />
        </button>
      </div>
      {error  && <p className="text-xs text-red-600">{error}</p>}
      {saved  && <p className="text-xs text-green-600">✓ Guardado</p>}
    </div>
  );
}

"use client";
import { useState, useTransition } from "react";

interface Branch { id: string; name: string; }
interface Solicitud { id: string; estado: string; branch: { name: string } | null; }

export function SolicitarActivacion({ branches, solicitud, requisitos }: {
  branches: Branch[];
  solicitud: Solicitud | null;
  requisitos: string;
}) {
  const [step, setStep] = useState<"idle" | "form" | "requisitos">("idle");
  const [branchId, setBranchId] = useState("");
  const [aceptado, setAceptado] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [, startTransition] = useTransition();

  if (success || solicitud) {
    const branchName = solicitud
      ? (Array.isArray(solicitud.branch) ? solicitud.branch[0]?.name : solicitud.branch?.name) ?? ""
      : "";
    return (
      <div className="w-full max-w-sm text-center space-y-2 bg-blue-900/50 rounded-2xl p-5 border border-blue-700">
        <p className="text-2xl">⏳</p>
        <p className="text-white font-semibold">Solicitud enviada</p>
        <p className="text-blue-300 text-sm">
          Tu solicitud {branchName ? `para ${branchName}` : ""} esta pendiente de aprobacion.
        </p>
      </div>
    );
  }

  function handleSolicitar() {
    if (!branchId) { setError("Selecciona una sucursal"); return; }
    if (requisitos && !aceptado) { setError("Debes aceptar los requisitos"); return; }
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/agua-energetica/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch_id: branchId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Error al enviar solicitud"); return; }
      setSuccess(true);
    });
  }

  if (step === "idle") {
    return (
      <button onClick={() => setStep(requisitos ? "requisitos" : "form")}
        className="w-full max-w-sm rounded-2xl bg-blue-500 py-4 text-base font-bold text-white hover:bg-blue-400 transition active:scale-95 shadow-lg">
        💧 Solicitar activacion
      </button>
    );
  }

  if (step === "requisitos") {
    return (
      <div className="w-full max-w-sm bg-blue-900/80 rounded-2xl p-5 space-y-4 border border-blue-700">
        <h2 className="text-white font-bold text-center">Requisitos y terminos</h2>
        <div className="bg-blue-950/50 rounded-xl p-4 max-h-48 overflow-y-auto">
          <p className="text-blue-200 text-sm whitespace-pre-wrap">{requisitos}</p>
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={aceptado} onChange={e => setAceptado(e.target.checked)}
            className="mt-1 h-4 w-4 rounded" />
          <span className="text-blue-200 text-sm">Acepto los requisitos y terminos del servicio</span>
        </label>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => setStep("idle")}
            className="flex-1 rounded-xl border border-blue-600 py-2.5 text-sm text-blue-300 hover:bg-blue-800 transition">
            Cancelar
          </button>
          <button onClick={() => { if (!aceptado) { setError("Debes aceptar los requisitos"); return; } setStep("form"); }}
            className="flex-1 rounded-xl bg-blue-500 py-2.5 text-sm font-semibold text-white hover:bg-blue-400 transition">
            Continuar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm bg-blue-900/80 rounded-2xl p-5 space-y-4 border border-blue-700">
      <h2 className="text-white font-bold text-center">Selecciona una sucursal</h2>
      <select value={branchId} onChange={e => setBranchId(e.target.value)}
        style={{ color: "black" }}
        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:outline-none">
        <option value="">Selecciona sucursal</option>
        {branches.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => setStep("idle")}
          className="flex-1 rounded-xl border border-blue-600 py-2.5 text-sm text-blue-300 hover:bg-blue-800 transition">
          Cancelar
        </button>
        <button onClick={handleSolicitar}
          className="flex-1 rounded-xl bg-blue-500 py-2.5 text-sm font-semibold text-white hover:bg-blue-400 transition">
          Enviar solicitud
        </button>
      </div>
    </div>
  );
}
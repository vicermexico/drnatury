"use client";
import { useState } from "react";

export function GenerarLinkAgendar({ therapistId }: { therapistId?: string }) {
  const [open, setOpen] = useState(false);
  const [copiado, setCopiado] = useState(false);

  function buildLink() {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return therapistId ? `${base}/agendar-link?t=${therapistId}` : `${base}/agendar-link`;
  }

  async function handleCopiar() {
    const link = buildLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Si el navegador no permite clipboard, al menos ya esta visible el input para copiar a mano.
    }
  }

  function handleWhatsApp() {
    const msg = encodeURIComponent(
      `Hola, aquí puedes agendar tu cita en DrNatury: ${buildLink()}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-2xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition mb-5"
      >
        🔗 Mandarle el link al paciente para que agende él mismo
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 space-y-3 mb-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-blue-900">Link para agendar</p>
        <button onClick={() => setOpen(false)} className="text-blue-400 hover:text-blue-600 text-sm">✕</button>
      </div>
      <p className="text-xs text-blue-700">
        {therapistId
          ? "El paciente va a elegir directo en tu sucursal (consultorio o a domicilio)."
          : "El paciente va a elegir la sucursal, el servicio y el horario."}
      </p>
      <input
        readOnly
        value={buildLink()}
        onFocus={e => e.target.select()}
        style={{ color: "black" }}
        className="w-full rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs"
      />
      <div className="flex gap-2">
        <button onClick={handleCopiar}
          className="flex-1 rounded-xl bg-white border border-blue-300 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition">
          {copiado ? "✓ Copiado" : "Copiar link"}
        </button>
        <button onClick={handleWhatsApp}
          className="flex-1 rounded-xl bg-green-500 hover:bg-green-600 transition py-2 text-xs font-semibold text-white">
          💬 Mandar por WhatsApp
        </button>
      </div>
    </div>
  );
}

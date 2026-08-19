"use client";
import { useState, useTransition } from "react";

export function WhatsappCitasForm({ conPdf, sinPdf }: { conPdf: string; sinPdf: string }) {
  const [msgConPdf,  setMsgConPdf]  = useState(conPdf);
  const [msgSinPdf, setMsgSinPdf] = useState(sinPdf);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function handleSave() {
    setError(""); setSaved(false);
    startTransition(async () => {
      const res = await fetch("/api/whatsapp-templates/cita_con_pdf", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: msgConPdf }),
      });
      const res2 = await fetch("/api/whatsapp-templates/cita_sin_pdf", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: msgSinPdf }),
      });
      if (!res.ok || !res2.ok) { setError("Error al guardar"); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Mensaje CON PDF</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Se envia cuando la terapeuta subio un PDF a la cita. Usa {"{nombre}"} para el nombre del paciente y {"{link}"} para el link del PDF.
          </p>
        </div>
        <textarea
          value={msgConPdf}
          onChange={e => setMsgConPdf(e.target.value)}
          rows={5}
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:border-blue-500 focus:outline-none"
          placeholder="Hola {nombre}, aqui esta tu resultado: {link}"
        />
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Mensaje SIN PDF</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Se envia cuando no hay PDF adjunto. Usa {"{nombre}"} para el nombre del paciente.
          </p>
        </div>
        <textarea
          value={msgSinPdf}
          onChange={e => setMsgSinPdf(e.target.value)}
          rows={5}
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:border-blue-500 focus:outline-none"
          placeholder="Hola {nombre}, gracias por tu visita. Quedamos a tus ordenes."
        />
      </div>

      {error  && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {saved  && <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">✓ Mensajes guardados</p>}

      <button
        onClick={handleSave}
        disabled={isPending}
        className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 transition disabled:opacity-60"
      >
        {isPending ? "Guardando..." : "Guardar mensajes"}
      </button>
    </div>
  );
}


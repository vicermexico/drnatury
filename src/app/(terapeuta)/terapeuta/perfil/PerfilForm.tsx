"use client";
import { useState, useTransition } from "react";

export function PerfilForm({
  name,
  loginPhone,
  whatsappNumber,
}: {
  name: string;
  loginPhone: string;
  whatsappNumber: string;
}) {
  const [whatsapp, setWhatsapp] = useState(whatsappNumber);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function handleSave() {
    setError(""); setSaved(false);
    startTransition(async () => {
      const res = await fetch("/api/terapeuta/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp_number: whatsapp }),
      });
      if (!res.ok) { setError("No se pudo guardar"); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
          <p className="text-sm text-gray-900">{name}</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Celular con el que entras al sistema
          </label>
          <p className="text-sm text-gray-900">{loginPhone}</p>
        </div>
        <div className="pt-2 border-t border-gray-100">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Número de WhatsApp para mandar recetas
          </label>
          <p className="text-xs text-gray-400 mb-1.5">
            Puede ser distinto al celular de arriba. Ten sesión iniciada con este número en
            WhatsApp de tu celular o computadora cuando mandes una receta.
          </p>
          <input
            type="tel"
            value={whatsapp}
            onChange={e => setWhatsapp(e.target.value)}
            placeholder="Ej: 8112345678"
            style={{ color: "black" }}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none"
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {saved && <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">✓ Guardado</p>}
      <button onClick={handleSave} disabled={isPending}
        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
        {isPending ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}

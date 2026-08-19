"use client";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";

export function MovimientoTerapeutaForm({
  productId,
  currentStock,
}: {
  productId:    string;
  currentStock: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cantidad,     setCantidad]     = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [notes,        setNotes]        = useState("");
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState("");
  const [patientName,  setPatientName]  = useState("");
  const [searching,    setSearching]    = useState(false);

  const previewQty = cantidad.trim() ? currentStock - (parseInt(cantidad, 10) || 0) : null;

  useEffect(() => {
    const phone = patientPhone.replace(/\D/g, "");
    if (phone.length < 3) {
      setPatientName("");
      return;
    }
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/patients?q=${phone}`);
        const data = await res.json() as { id: string; name: string; phone: string }[];
        if (phone.length >= 10) {
          const match = data.find(p =>
            p.phone === phone ||
            p.phone === phone.slice(-10) ||
            phone === p.phone.slice(-10)
          );
          setPatientName(match?.name ?? "");
        } else {
          setPatientName(data.length > 0 ? data[0].name : "");
        }
      } catch {
        setPatientName("");
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [patientPhone]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseInt(cantidad, 10);
    if (!qty || qty <= 0) { setError("Ingresa una cantidad mayor a cero"); return; }
    const phone = patientPhone.replace(/\D/g, "");
    if (phone.length < 8) { setError("Ingresa el numero de celular completo"); return; }
    setError(""); setSuccess("");

    startTransition(async () => {
      const res = await fetch("/api/inventory/branch-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id:    productId,
          delta:         -qty,
          patient_phone: phone,
          notes:         notes.trim() || undefined,
        }),
      });
      const data = await res.json() as { message?: string; patient_name?: string };
      if (!res.ok) { setError(data.message ?? "Error al registrar la salida"); return; }
      setCantidad(""); setPatientPhone(""); setNotes(""); setPatientName("");
      setSuccess(data.patient_name
        ? `Salida registrada - Paciente: ${data.patient_name}`
        : "Salida registrada");
      router.refresh();
      setTimeout(() => setSuccess(""), 4000);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-orange-200 bg-orange-50 px-4 py-3">
        <p className="text-sm font-bold text-orange-700">⚠ Salida a paciente</p>
        <p className="text-xs text-gray-500 mt-0.5">Entrega de producto a un paciente</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Celular del paciente <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            inputMode="numeric"
            required
            value={patientPhone}
            onChange={e => setPatientPhone(e.target.value.replace(/\D/g, ""))}
            placeholder="Ej: 8112345678"
            style={{ color: "black" }}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base tracking-widest focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
          {searching && (
            <p className="text-xs text-gray-400 mt-1">Buscando paciente...</p>
          )}
          {patientName && (
            <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 mt-1 font-medium">
              ✓ {patientName}
            </p>
          )}
          {!searching && !patientName && patientPhone.replace(/\D/g,"").length >= 10 && (
            <p className="text-xs text-amber-600 mt-1">Paciente no registrado</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cantidad <span className="text-red-500">*</span>
            {previewQty !== null && (
              <span className={`ml-2 text-xs font-normal ${previewQty < 0 ? "text-red-500" : "text-gray-400"}`}>
                &rarr; stock: {previewQty}
              </span>
            )}
          </label>
          <input
            type="number"
            min="1"
            max={currentStock}
            required
            value={cantidad}
            onChange={e => setCantidad(e.target.value)}
            style={{ color: "black" }}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Opcional"
            style={{ color: "black" }}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-orange-400 focus:outline-none"
          />
        </div>

        {error   && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
        {success && <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">{success}</p>}

        <button
          type="submit"
          disabled={isPending || (previewQty !== null && previewQty < 0)}
          className="w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition disabled:opacity-60"
        >
          {isPending ? "Registrando..." : "Registrar salida"}
        </button>
      </form>
    </div>
  );
}
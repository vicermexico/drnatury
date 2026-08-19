"use client";
import { useState, useTransition } from "react";

interface Producto {
  id: string;
  name: string;
  image_url: string | null;
  quantity: number;
}

export function VentasAlmacenForm({ productos, userId }: { productos: Producto[]; userId: string }) {
  const [productId, setProductId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [patientPhone, setPatientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedProduct = productos.find(p => p.id === productId);

  function handleSubmit() {
    if (!productId) { setError("Selecciona un producto"); return; }
    if (!patientPhone || patientPhone.replace(/\D/g,"").length < 10) { setError("Ingresa el celular del cliente"); return; }
    const qty = parseInt(cantidad);
    if (!qty || qty < 1) { setError("Cantidad invalida"); return; }
    if (selectedProduct && qty > selectedProduct.quantity) { setError(`Stock insuficiente. Disponible: ${selectedProduct.quantity}`); return; }

    setError(""); setSuccess("");
    startTransition(async () => {
      const res = await fetch("/api/inventory/warehouse-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          delta: -qty,
          patient_phone: patientPhone.replace(/\D/g,""),
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Error al registrar venta"); return; }
      setSuccess(`Venta registrada: ${qty} x ${selectedProduct?.name}`);
      setProductId(""); setCantidad("1"); setPatientPhone(""); setNotes("");
      setTimeout(() => setSuccess(""), 4000);
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Producto *</label>
          <select value={productId} onChange={e => setProductId(e.target.value)}
            style={{ color: "black" }}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:border-blue-500 focus:outline-none">
            <option value="">Selecciona un producto</option>
            {productos.map(p => (
              <option key={p.id} value={p.id}>{p.name} (Stock: {p.quantity})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
          <input type="number" min="1" max={selectedProduct?.quantity ?? 999}
            value={cantidad} onChange={e => setCantidad(e.target.value)}
            style={{ color: "black" }}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Celular del cliente *</label>
          <input type="tel" value={patientPhone} onChange={e => setPatientPhone(e.target.value)}
            placeholder="10 digitos"
            style={{ color: "black" }}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Observaciones..."
            style={{ color: "black" }}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none" />
        </div>

        {error   && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
        {success && <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">✓ {success}</p>}

        <button onClick={handleSubmit} disabled={isPending}
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {isPending ? "Registrando..." : "Registrar venta"}
        </button>
      </div>
    </div>
  );
}

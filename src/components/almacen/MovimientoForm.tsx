"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Branch { id: string; name: string; }

export function MovimientoForm({
  productId,
  currentStock,
  branches,
}: {
  productId:    string;
  currentStock: number;
  branches:     Branch[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tipo,     setTipo]     = useState<"ENTRADA_PROVEEDOR" | "SURTIDO_ALMACEN">("ENTRADA_PROVEEDOR");
  const [cantidad, setCantidad] = useState("");
  const [branchId, setBranchId] = useState("");
  const [notes,    setNotes]    = useState("");
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  const isSalida  = tipo === "SURTIDO_ALMACEN";
  const sign      = isSalida ? -1 : 1;
  const previewQty = cantidad.trim() ? currentStock + sign * (parseInt(cantidad, 10) || 0) : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseInt(cantidad, 10);
    if (!qty || qty <= 0) { setError("Ingresa una cantidad mayor a cero"); return; }
    if (isSalida && !branchId) { setError("Selecciona la sucursal destino"); return; }
    setError("");
    setSuccess("");

    startTransition(async () => {
      const res = await fetch("/api/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          type:       tipo,
          delta:      sign * qty,
          branch_id:  isSalida ? branchId : undefined,
          notes:      notes.trim() || undefined,
        }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "Error al registrar el movimiento");
        return;
      }
      setCantidad(""); setBranchId(""); setNotes("");
      setSuccess("Movimiento registrado correctamente");
      router.refresh();
      setTimeout(() => setSuccess(""), 3000);
    });
  }

  return (
    <div className="space-y-4">
      {/* Selector de tipo */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => { setTipo("ENTRADA_PROVEEDOR"); setBranchId(""); setError(""); }}
          className={[
            "rounded-xl border-2 px-4 py-3 text-left transition",
            tipo === "ENTRADA_PROVEEDOR"
              ? "border-green-500 bg-green-50"
              : "border-gray-200 bg-white hover:border-gray-300",
          ].join(" ")}
        >
          <p className={`text-sm font-bold ${tipo === "ENTRADA_PROVEEDOR" ? "text-green-700" : "text-gray-800"}`}>
            ＋ Entrada
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Recepción de proveedor</p>
        </button>

        <button
          type="button"
          onClick={() => { setTipo("SURTIDO_ALMACEN"); setError(""); }}
          className={[
            "rounded-xl border-2 px-4 py-3 text-left transition",
            tipo === "SURTIDO_ALMACEN"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 bg-white hover:border-gray-300",
          ].join(" ")}
        >
          <p className={`text-sm font-bold ${tipo === "SURTIDO_ALMACEN" ? "text-blue-700" : "text-gray-800"}`}>
            － Salida
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Enviar a sucursal</p>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Sucursal destino (solo en salidas) */}
        {isSalida && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sucursal destino <span className="text-red-500">*</span>
            </label>
            {branches.length === 0 ? (
              <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
                No hay sucursales activas.
              </p>
            ) : (
              <select
                required
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 bg-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Seleccionar sucursal…</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Cantidad */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cantidad *
            {previewQty !== null && (
              <span className={`ml-2 text-xs font-normal ${previewQty < 0 ? "text-red-500" : "text-gray-400"}`}>
                → stock: {previewQty}
              </span>
            )}
          </label>
          <input
            type="number"
            min={1}
            required
            value={cantidad}
            onChange={e => setCantidad(e.target.value)}
            placeholder="0"
            style={{ color: "black" }}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Notas */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Opcional — proveedor, factura, etc."
            style={{ color: "black" }}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        {error   && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
        {success && <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">✓ {success}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-700 transition disabled:opacity-60"
        >
          {isPending ? "Registrando…" : `Registrar ${isSalida ? "salida" : "entrada"}`}
        </button>
      </form>
    </div>
  );
}

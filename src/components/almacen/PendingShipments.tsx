"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Shipment {
  id: string;
  quantity_before: number;
  quantity_after:  number;
  notes:           string | null;
  performed_at:    string;
  products: { id: string; name: string; image_url: string | null } | null;
  sender:   { name: string } | null;
}

interface Props {
  productId?: string;  // si se pasa, solo muestra envíos de ese producto
}

function qty(s: Shipment) {
  return s.quantity_before - s.quantity_after;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Monterrey",
  });
}

export function PendingShipments({ productId }: Props) {
  const router  = useRouter();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  useEffect(() => {
    fetch("/api/inventory/pending-receipts")
      .then(async r => {
        const data: unknown = await r.json();
        if (!r.ok || !Array.isArray(data)) {
          const msg = (data as { message?: string })?.message;
          setError(msg ?? "Error al cargar los envíos pendientes");
          return;
        }
        const filtered = productId
          ? (data as Shipment[]).filter(s => {
              const p = Array.isArray(s.products) ? s.products[0] : s.products;
              return p?.id === productId;
            })
          : (data as Shipment[]);
        setShipments(filtered);
      })
      .catch(() => setError("Error al cargar los envíos pendientes"))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) return <p className="text-sm text-gray-400 text-center py-4">Cargando envíos…</p>;
  if (error)   return <p className="text-sm text-red-500 text-center py-4">{error}</p>;
  if (shipments.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-4 text-center">
        <p className="text-sm text-gray-500">No hay envíos pendientes de recibir.</p>
        <p className="text-xs text-gray-400 mt-1">El almacenista debe registrar una salida hacia tu sucursal primero.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {shipments.map(s => <ShipmentCard key={s.id} shipment={s} onConfirmed={() => { router.refresh(); setShipments(prev => prev.filter(x => x.id !== s.id)); }} />)}
    </div>
  );
}

function ShipmentCard({ shipment, onConfirmed }: { shipment: Shipment; onConfirmed: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming]  = useState(false);
  const [error,      setError]       = useState("");

  const product = Array.isArray(shipment.products) ? shipment.products[0] : shipment.products;
  const sender  = Array.isArray(shipment.sender)   ? shipment.sender[0]   : shipment.sender;
  const sent    = qty(shipment);

  function handleConfirm() {
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/inventory/pending-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movement_id: shipment.id }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) { setError(data.message ?? "Error al confirmar"); return; }
      onConfirmed();
    });
  }

  if (confirming) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4 space-y-3">
        <p className="text-sm font-medium text-green-800">
          ¿Confirmas la recepción de <span className="font-bold">{sent} unidades</span> de{" "}
          <span className="font-bold">{product?.name}</span>?
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => setConfirming(false)} disabled={isPending}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-white transition">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={isPending}
            className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 transition disabled:opacity-60">
            {isPending ? "Confirmando…" : "Sí, recibí"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-2xl bg-white border border-gray-200 px-4 py-3 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {product?.image_url ? (
          <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-100">
            <Image src={product.image_url} alt={product.name ?? ""} fill className="object-cover" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-lg">📦</div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{product?.name}</p>
          <p className="text-xs text-gray-500">
            {sent} unidades — {sender?.name ? `enviado por ${sender.name}` : "enviado por almacén"}
          </p>
          <p className="text-xs text-gray-400">{fmtDate(shipment.performed_at)}</p>
        </div>
      </div>
      <button
        onClick={() => setConfirming(true)}
        className="shrink-0 rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 transition"
      >
        Recibir
      </button>
    </div>
  );
}

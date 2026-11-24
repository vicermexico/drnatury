"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

interface Pedido {
  id: string;
  nombre: string;
  celular: string;
  direccion: string;
  cantidad: number;
  precio_total: number;
  horario: string;
  lat: number | null;
  lng: number | null;
  orden_en_ruta: number | null;
  estado: string;
  motivo_rechazo: string | null;
}

interface Ruta {
  id: string;
  etiqueta: string;
  pedidos: Pedido[];
}

const MOTIVOS_RAPIDOS = [
  "No estaba en casa",
  "No contestó",
  "Canceló el pedido",
  "Dirección equivocada",
  "Otro motivo",
];

function linkMapa(p: Pedido): string {
  if (p.lat !== null && p.lng !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.direccion)}`;
}

function TarjetaPedido({ pedido, onActualizado }: { pedido: Pedido; onActualizado: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [error, setError] = useState("");

  function marcar(estado: "entregado" | "rechazado", motivo?: string) {
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/chofer/pedidos/${pedido.id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, motivo }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) { setError(data.message ?? "Error al actualizar"); return; }
      setPidiendoMotivo(false);
      onActualizado();
    });
  }

  if (pedido.estado === "entregado") {
    return (
      <div className="rounded-2xl bg-green-50 border border-green-200 p-4">
        <p className="text-sm font-semibold text-green-800">✅ {pedido.nombre} — entregado</p>
      </div>
    );
  }
  if (pedido.estado === "rechazado") {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
        <p className="text-sm font-semibold text-red-800">❌ {pedido.nombre} — no entregado</p>
        {pedido.motivo_rechazo && <p className="text-xs text-red-600 mt-0.5">{pedido.motivo_rechazo}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-gray-400">Parada {pedido.orden_en_ruta}</p>
          <p className="text-sm font-semibold text-gray-900">{pedido.nombre}</p>
          <p className="text-sm text-gray-600">{pedido.direccion}</p>
        </div>
        <a href={`tel:${pedido.celular}`} className="shrink-0 text-xs text-blue-600 underline">Llamar</a>
      </div>
      <p className="text-xs text-gray-500">
        {pedido.cantidad} pomada{pedido.cantidad !== 1 ? "s" : ""} · {pedido.horario} · Cobrar: ${pedido.precio_total} MXN
      </p>

      <a
        href={linkMapa(pedido)}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
      >
        📍 Ir a entregar
      </a>

      {pidiendoMotivo ? (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-gray-500">¿Por qué no se pudo entregar?</p>
          {MOTIVOS_RAPIDOS.map((m) => (
            <button key={m} type="button" disabled={isPending} onClick={() => marcar("rechazado", m)}
              className="w-full text-left rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition disabled:opacity-60">
              {m}
            </button>
          ))}
          <button type="button" onClick={() => setPidiendoMotivo(false)}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 pt-1">
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" disabled={isPending} onClick={() => marcar("entregado")}
            className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition disabled:opacity-60">
            Entregado
          </button>
          <button type="button" disabled={isPending} onClick={() => setPidiendoMotivo(true)}
            className="flex-1 rounded-xl border border-red-300 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-60">
            No entregado
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
    </div>
  );
}

export function RutaDelDia() {
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/chofer/ruta");
      const data = await res.json() as { rutas: Ruta[] };
      setRutas(data.rutas ?? []);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) return <p className="text-sm text-gray-400 text-center pt-10">Cargando…</p>;

  const rutasConPedidos = rutas.filter((r) => r.pedidos.length > 0);

  if (rutasConPedidos.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center pt-12 space-y-3">
        <p className="text-4xl">🚚</p>
        <h1 className="text-lg font-bold text-gray-900">Panel de entregas</h1>
        <p className="text-sm text-gray-500">
          Todavía no tienes ninguna ruta asignada. En cuanto Master te asigne entregas, van a aparecer aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      {rutasConPedidos.map((r) => {
        const pendientes = r.pedidos.filter((p) => p.estado === "pendiente").length;
        return (
          <div key={r.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">{r.etiqueta}</h2>
              <span className="text-xs text-gray-400">{pendientes} pendiente{pendientes !== 1 ? "s" : ""}</span>
            </div>
            {r.pedidos.map((p) => (
              <TarjetaPedido key={p.id} pedido={p} onActualizado={cargar} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

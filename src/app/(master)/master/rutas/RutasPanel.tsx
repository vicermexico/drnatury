"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import type { GrupoMapa } from "./MapaRutas";

// El mapa se carga sin SSR (ver comentario en MapaRutas.tsx) -- aqui
// solo se le pasan los datos ya calculados.
const MapaRutas = dynamic(() => import("./MapaRutas").then((m) => m.MapaRutas), { ssr: false });

interface Pedido {
  id: string;
  nombre: string;
  celular: string;
  direccion: string;
  cantidad: number;
  horario: string;
  lat: number | null;
  lng: number | null;
  ruta_id: string | null;
  orden_en_ruta: number | null;
}

interface Ruta {
  id: string;
  etiqueta: string;
  choferId: string | null;
  choferNombre: string | null;
  pedidos: Pedido[];
}

interface Chofer {
  id: string;
  name: string;
}

interface ResumenHoy {
  entregados: number;
  rechazados: number;
  montoCobrado: number;
  motivos: { motivo: string; cantidad: number }[];
}

// Colores por ruta, en el orden en que se van creando -- los pedidos
// sin ruta todavia se pintan en gris (ver GRIS mas abajo).
const COLORES = ["#2563eb", "#16a34a", "#d97706", "#db2777", "#7c3aed", "#0891b2", "#dc2626", "#65a30d"];
const GRIS = "#9ca3af";

export function RutasPanel({ choferes }: { choferes: Chofer[] }) {
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [pendientesConUbicacion, setPendientesConUbicacion] = useState<Pedido[]>([]);
  const [pendientesSinUbicacion, setPendientesSinUbicacion] = useState<Pedido[]>([]);
  const [resumenHoy, setResumenHoy] = useState<ResumenHoy | null>(null);
  const [cargando, setCargando] = useState(true);
  const [tamanos, setTamanos] = useState<string[]>(["10", "10"]);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/master/rutas");
      const data = await res.json() as {
        rutas: Ruta[];
        pendientesConUbicacion: Pedido[];
        pendientesSinUbicacion: Pedido[];
        resumenHoy: ResumenHoy;
      };
      setRutas(data.rutas ?? []);
      setPendientesConUbicacion(data.pendientesConUbicacion ?? []);
      setPendientesSinUbicacion(data.pendientesSinUbicacion ?? []);
      setResumenHoy(data.resumenHoy ?? null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function generarRutas() {
    setError("");
    const numeros = tamanos.map((t) => parseInt(t, 10)).filter((n) => Number.isInteger(n) && n > 0);
    if (numeros.length === 0) {
      setError("Dime al menos un tamaño de ruta (ej. 10)");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/master/rutas/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tamanos: numeros }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) { setError(data.message ?? "Error al generar las rutas"); return; }
      await cargar();
    });
  }

  function asignarChofer(rutaId: string, choferId: string) {
    startTransition(async () => {
      await fetch(`/api/master/rutas/${rutaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chofer_id: choferId || null }),
      });
      await cargar();
    });
  }

  function deshacerRuta(rutaId: string) {
    startTransition(async () => {
      await fetch(`/api/master/rutas/${rutaId}`, { method: "DELETE" });
      await cargar();
    });
  }

  const gruposMapa: GrupoMapa[] = [
    ...rutas.map((r, i) => ({
      color: COLORES[i % COLORES.length],
      etiqueta: r.etiqueta,
      pedidos: r.pedidos
        .filter((p): p is Pedido & { lat: number; lng: number } => p.lat !== null && p.lng !== null)
        .map((p) => ({
          id: p.id, nombre: p.nombre, direccion: p.direccion, cantidad: p.cantidad,
          horario: p.horario, lat: p.lat, lng: p.lng, orden: p.orden_en_ruta,
        })),
    })),
    {
      color: GRIS,
      etiqueta: "Pendiente de agrupar",
      pedidos: pendientesConUbicacion.map((p) => ({
        id: p.id, nombre: p.nombre, direccion: p.direccion, cantidad: p.cantidad,
        horario: p.horario, lat: p.lat as number, lng: p.lng as number, orden: null,
      })),
    },
  ];

  if (cargando) {
    return <p className="text-sm text-gray-400">Cargando…</p>;
  }

  return (
    <div className="space-y-6">
      {resumenHoy && (resumenHoy.entregados > 0 || resumenHoy.rechazados > 0) && (
        <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Resumen de hoy</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-green-50 p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{resumenHoy.entregados}</p>
              <p className="text-xs text-green-700 mt-0.5">Entregados</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{resumenHoy.rechazados}</p>
              <p className="text-xs text-red-600 mt-0.5">No entregados</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">${resumenHoy.montoCobrado}</p>
              <p className="text-xs text-blue-700 mt-0.5">Cobrado (MXN)</p>
            </div>
          </div>
          {resumenHoy.motivos.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Motivos de rechazo</p>
              <ul className="space-y-1">
                {resumenHoy.motivos.map((m) => (
                  <li key={m.motivo} className="text-sm text-gray-600 flex justify-between">
                    <span>{m.motivo}</span>
                    <span className="font-medium text-gray-900">{m.cantidad}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <MapaRutas grupos={gruposMapa} />

      <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Generar rutas nuevas</h2>
        <p className="text-xs text-gray-400">
          {pendientesConUbicacion.length} pedido{pendientesConUbicacion.length !== 1 ? "s" : ""} pendiente{pendientesConUbicacion.length !== 1 ? "s" : ""} por agrupar (en gris en el mapa)
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {tamanos.map((t, i) => (
            <input
              key={i}
              type="number"
              inputMode="numeric"
              min={1}
              value={t}
              onChange={(e) => setTamanos((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
              className="w-20 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="10"
            />
          ))}
          <button type="button" onClick={() => setTamanos((prev) => [...prev, "10"])}
            className="rounded-xl border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition">
            + ruta
          </button>
          {tamanos.length > 1 && (
            <button type="button" onClick={() => setTamanos((prev) => prev.slice(0, -1))}
              className="text-xs text-gray-400 hover:text-gray-600">
              quitar una
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}
        <button type="button" onClick={generarRutas} disabled={isPending}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {isPending ? "Generando…" : "Generar rutas"}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Rutas armadas</h2>
        {rutas.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no hay ninguna ruta armada.</p>
        ) : (
          rutas.map((r, i) => (
            <div key={r.id} className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORES[i % COLORES.length] }} />
                  <p className="text-sm font-semibold text-gray-900">{r.etiqueta}</p>
                  <span className="text-xs text-gray-400">{r.pedidos.length} pedido{r.pedidos.length !== 1 ? "s" : ""}</span>
                </div>
                <button type="button" onClick={() => deshacerRuta(r.id)} disabled={isPending}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-60">
                  Deshacer ruta
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Chofer:</label>
                <select
                  value={r.choferId ?? ""}
                  onChange={(e) => asignarChofer(r.id, e.target.value)}
                  disabled={isPending}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                >
                  <option value="">Sin asignar</option>
                  {choferes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <ol className="space-y-1.5 text-sm">
                {r.pedidos.map((p) => (
                  <li key={p.id} className="flex items-start gap-2">
                    <span className="text-gray-400 shrink-0">{p.orden_en_ruta}.</span>
                    <span className="text-gray-700">
                      {p.nombre} — {p.direccion} ({p.cantidad} pomada{p.cantidad !== 1 ? "s" : ""}, {p.horario})
                      {p.lat === null && <span className="text-amber-600"> · sin GPS, solo dirección escrita</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))
        )}
      </section>

      {pendientesSinUbicacion.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Pedidos sin ubicación de GPS ({pendientesSinUbicacion.length})
          </h2>
          <p className="text-xs text-gray-400">
            No se pueden agrupar en el mapa porque el cliente no mandó su ubicación -- repártelos a mano.
          </p>
          <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100">
            {pendientesSinUbicacion.map((p) => (
              <div key={p.id} className="px-5 py-3 text-sm text-gray-700">
                {p.nombre} — {p.direccion} ({p.cantidad} pomada{p.cantidad !== 1 ? "s" : ""}, {p.horario}) · {p.celular}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

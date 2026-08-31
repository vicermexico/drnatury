"use client";
import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Corte, ComisionRow } from "./page";

interface Props {
  tab:       "historial" | "cortes";
  desde:     string;
  hasta:     string;
  historial: ComisionRow[];
  cortes:    Corte[];
}

export function EstadoCuentaClient({ tab, desde, hasta, historial, cortes }: Props) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [desdeLocal, setDesdeLocal] = useState(desde);
  const [hastaLocal, setHastaLocal] = useState(hasta);

  function updateParams(updates: Record<string, string>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) p.set(k, v); else p.delete(k);
    }
    startTransition(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }));
  }

  const total = historial.reduce((sum, c) => sum + (c.monto ?? 0), 0);

  function fmtDate(iso: string) {
    const normalized = iso.includes("T") ? iso : `${iso}T12:00:00`;
    return new Date(normalized).toLocaleDateString("es-MX", {
      day: "2-digit", month: "short", year: "numeric",
      timeZone: "America/Monterrey",
    });
  }

  function fmtMoney(n: number) {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
  }

  return (
    <div className="space-y-4">

      {/* Tabs */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white p-1 gap-1">
        <TabBtn active={tab === "historial"} label="Historial"
          onClick={() => updateParams({ tab: "historial" })} />
        <TabBtn active={tab === "cortes"} label="Cortes"
          onClick={() => updateParams({ tab: "cortes" })} />
      </div>

      {tab === "historial" ? (
        <div className="space-y-4">

          {/* Filtro de fechas */}
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Desde</label>
              <input
                type="date"
                value={desdeLocal}
                onChange={e => setDesdeLocal(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Hasta</label>
              <input
                type="date"
                value={hastaLocal}
                onChange={e => setHastaLocal(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              onClick={() => updateParams({ tab: "historial", desde: desdeLocal, hasta: hastaLocal })}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition"
            >
              Buscar
            </button>
          </div>

          {/* Tabla de comisiones agrupada por pedido */}
          {historial.length === 0 ? (
            <div className="rounded-2xl bg-white border border-dashed border-gray-200 p-8 text-center">
              <p className="text-gray-400 text-sm">Sin comisiones en este período</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Pedido #</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Fecha</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Productos</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Comisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historial.map(c => (
                    <tr key={c.pedido_biored_id}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{c.pedido_id}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(c.fecha)}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{c.productos}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-700 text-right whitespace-nowrap">{fmtMoney(c.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Total del período */}
          {historial.length > 0 && (
            <div className="rounded-2xl bg-green-50 border border-green-200 px-5 py-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-green-800">Total del período</p>
              <p className="text-lg font-bold text-green-700">{fmtMoney(total)}</p>
            </div>
          )}
        </div>

      ) : (
        /* Tab Cortes */
        <div className="space-y-3">
          {cortes.length === 0 ? (
            <div className="rounded-2xl bg-white border border-dashed border-gray-200 p-8 text-center">
              <p className="text-gray-400 text-sm">Sin cortes registrados</p>
            </div>
          ) : cortes.map((c, i) => (
            <div key={c.id} className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">Corte #{cortes.length - i}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {fmtDate(c.fecha_inicio)} — {fmtDate(c.fecha_fin)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    c.estado === "pagado"
                      ? "bg-green-50 text-green-700"
                      : "bg-yellow-50 text-yellow-700"
                  }`}>
                    {c.estado === "pagado" ? "Pagado" : "Pendiente"}
                  </span>
                  <p className="text-base font-bold text-gray-900">{fmtMoney(c.monto_total)}</p>
                </div>
              </div>

              {c.estado === "pagado" && (c.imagen_pago_url || c.nota_pago) && (
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  {c.nota_pago && (
                    <p className="text-sm font-medium text-gray-700">
                      <span className="text-red-500 mr-1">●</span>{c.nota_pago}
                    </p>
                  )}
                  {c.imagen_pago_url && (
                    <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                      <img
                        src={c.imagen_pago_url}
                        alt="Comprobante de pago"
                        className="w-full object-contain max-h-64"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-center py-2 text-sm font-medium rounded-lg transition ${
        active ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

"use client";
import { useTransition, useState, useRef } from "react";
import type { Persona, CorteRow, DesgloseState } from "./page";

interface Props {
  terapeutas:   Persona[];
  asistentes:   Persona[];
  cortes:       CorteRow[];
  verDesglose:  (state: DesgloseState | null, formData: FormData) => Promise<DesgloseState | null>;
  hacerCorte:   (formData: FormData) => Promise<void>;
  marcarPagado: (formData: FormData) => Promise<void>;
}

export function CortesClient({
  terapeutas, asistentes, cortes, verDesglose, hacerCorte, marcarPagado,
}: Props) {
  const [tab, setTab]               = useState<"hacer-corte" | "pagos">("hacer-corte");
  const [tipoPersona, setTipoPersona] = useState<"terapeuta" | "asistente">("terapeuta");

  const [desglose, setDesglose]              = useState<DesgloseState | null>(null);
  const [isPending, startDesgloseTransition]  = useTransition();
  const [isPendingCorte, startCorteTransition] = useTransition();
  const [corteExitoso, setCorteExitoso]       = useState(false);

  // Modal
  const [modalCorte, setModalCorte] = useState<CorteRow | null>(null);
  const [modalNota,   setModalNota]   = useState("");
  const [modalImagen, setModalImagen] = useState<File | null>(null);
  const [modalWarning, setModalWarning] = useState(false);
  const [modalSaving,  setModalSaving]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const personas = tipoPersona === "terapeuta" ? terapeutas : asistentes;

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "2-digit", month: "short", year: "numeric",
      timeZone: "America/Monterrey",
    });
  }

  function fmtMoney(n: number) {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
  }

  function handleVerDesglose(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startDesgloseTransition(async () => {
      const result = await verDesglose(null, fd);
      setDesglose(result);
    });
  }

  function handleHacerCorte() {
    if (!desglose || desglose.error || desglose.pedidos.length === 0) return;
    const fd = new FormData();
    fd.set("persona_id",   desglose.persona_id);
    fd.set("tipo_persona", desglose.tipo_persona);
    fd.set("fecha_inicio", desglose.fecha_inicio);
    fd.set("fecha_fin",    desglose.fecha_fin);
    fd.set("monto_total",  String(desglose.total));
    const allIds = desglose.pedidos.flatMap(p => p.comision_ids);
    fd.set("comision_ids", JSON.stringify(allIds));
    startCorteTransition(async () => {
      await hacerCorte(fd);
      setDesglose(null);
      setCorteExitoso(true);
    });
  }

  function openModal(corte: CorteRow) {
    setModalCorte(corte);
    setModalNota("");
    setModalImagen(null);
    setModalWarning(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function closeModal() {
    setModalCorte(null);
    setModalWarning(false);
  }

  async function submitMarcarPagado() {
    if (!modalNota.trim() && !modalImagen) {
      setModalWarning(true);
      return;
    }
    await doMarcarPagado();
  }

  async function doMarcarPagado() {
    if (!modalCorte) return;
    setModalSaving(true);
    const fd = new FormData();
    fd.set("corte_id", modalCorte.id);
    fd.set("nota", modalNota);
    if (modalImagen) fd.set("imagen", modalImagen);
    await marcarPagado(fd);
    setModalSaving(false);
    closeModal();
  }

  return (
    <div className="space-y-4">

      {/* Tabs */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white p-1 gap-1">
        <TabBtn active={tab === "hacer-corte"} label="Hacer Corte"     onClick={() => setTab("hacer-corte")} />
        <TabBtn active={tab === "pagos"}        label="Pagos de Cortes" onClick={() => setTab("pagos")}       />
      </div>

      {tab === "hacer-corte" ? (
        <div className="space-y-4">

          {/* Formulario de desglose */}
          <form onSubmit={handleVerDesglose} className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">

            <div className="flex gap-2">
              {(["terapeuta", "asistente"] as const).map(tipo => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setTipoPersona(tipo)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    tipoPersona === tipo
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {tipo === "terapeuta" ? "Terapeuta" : "Asistente"}
                </button>
              ))}
            </div>

            <input type="hidden" name="tipo_persona" value={tipoPersona} />

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">
                {tipoPersona === "terapeuta" ? "Terapeuta" : "Asistente"}
              </label>
              <select
                name="persona_id"
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Seleccionar...</option>
                {personas.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Desde</label>
                <input
                  type="date"
                  name="desde"
                  required
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Hasta</label>
                <input
                  type="date"
                  name="hasta"
                  required
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {isPending ? "Cargando..." : "Ver desglose"}
            </button>
          </form>

          {/* Resultado del desglose */}
          {desglose && (
            <div className="space-y-3">
              {desglose.error ? (
                <div className="rounded-2xl bg-red-50 border border-red-200 p-5">
                  <p className="text-sm font-medium text-red-800">{desglose.error}</p>
                </div>
              ) : desglose.pedidos.length === 0 ? (
                <div className="rounded-2xl bg-white border border-dashed border-gray-200 p-8 text-center">
                  <p className="text-gray-400 text-sm">Sin comisiones en este período</p>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl bg-white border border-gray-200 overflow-x-auto">
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
                        {desglose.pedidos.map(p => (
                          <tr key={p.pedido_biored_id}>
                            <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{p.pedido_id}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(p.fecha)}</td>
                            <td className="px-4 py-3 text-xs text-gray-700">{p.productos}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-green-700 text-right whitespace-nowrap">{fmtMoney(p.monto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-2xl bg-green-50 border border-green-200 px-5 py-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-green-800">Total del período</p>
                    <p className="text-lg font-bold text-green-700">{fmtMoney(desglose.total)}</p>
                  </div>

                  <button
                    onClick={handleHacerCorte}
                    disabled={isPendingCorte}
                    className="w-full py-3 rounded-xl text-sm font-bold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition"
                  >
                    {isPendingCorte ? "Guardando corte..." : `Hacer Corte — ${fmtMoney(desglose.total)}`}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

      ) : (
        /* Tab Pagos de Cortes */
        <div className="space-y-3">
          {cortes.length === 0 ? (
            <div className="rounded-2xl bg-white border border-dashed border-gray-200 p-8 text-center">
              <p className="text-gray-400 text-sm">Sin cortes registrados</p>
            </div>
          ) : cortes.map(c => (
            <div key={c.id} className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">{c.persona_nombre}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      c.tipo_persona === "terapeuta"
                        ? "bg-teal-50 text-teal-700"
                        : "bg-purple-50 text-purple-700"
                    }`}>
                      {c.tipo_persona === "terapeuta" ? "Terapeuta" : "Asistente"}
                    </span>
                    <p className="text-xs text-gray-400">{fmtDate(c.fecha_inicio)} — {fmtDate(c.fecha_fin)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
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

              {c.estado !== "pagado" && (
                <button
                  onClick={() => openModal(c)}
                  className="w-full py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition"
                >
                  Marcar como pagado
                </button>
              )}

              {c.estado === "pagado" && (c.imagen_pago_url || c.nota_pago) && (
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  {c.nota_pago && (
                    <p className="text-xs text-gray-500 italic">{c.nota_pago}</p>
                  )}
                  {c.imagen_pago_url && (
                    <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                      <img src={c.imagen_pago_url} alt="Comprobante de pago" className="w-full object-contain max-h-64" />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Corte Exitoso */}
      {corteExitoso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-4 text-center">
            <div className="text-4xl">✅</div>
            <h2 className="text-base font-bold text-gray-900">¡Corte realizado exitosamente!</h2>
            <button
              onClick={() => { setCorteExitoso(false); setTab("pagos"); }}
              className="w-full py-2.5 rounded-xl text-sm font-bold bg-gray-900 text-white hover:bg-gray-800 transition"
            >
              Ver pagos de cortes
            </button>
          </div>
        </div>
      )}

      {/* Modal Marcar Pagado */}
      {modalCorte && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4">

            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Marcar como pagado</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <p className="text-sm text-gray-500">
              <span className="font-medium text-gray-800">{modalCorte.persona_nombre}</span>
              {" — "}{fmtMoney(modalCorte.monto_total)}
            </p>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Nota (opcional)</label>
                <textarea
                  value={modalNota}
                  onChange={e => { setModalNota(e.target.value); setModalWarning(false); }}
                  rows={3}
                  placeholder="Ej: Transferencia BBVA ref. 12345"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Comprobante (opcional)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={e => { setModalImagen(e.target.files?.[0] ?? null); setModalWarning(false); }}
                  className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
                />
              </div>
            </div>

            {modalWarning ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                <p className="text-sm font-medium text-amber-800">
                  No hay evidencia del pago. ¿Deseas continuar de todas formas?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={doMarcarPagado}
                    disabled={modalSaving}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition"
                  >
                    {modalSaving ? "Guardando..." : "Continuar"}
                  </button>
                  <button
                    onClick={() => setModalWarning(false)}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={submitMarcarPagado}
                  disabled={modalSaving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {modalSaving ? "Guardando..." : "Confirmar pago"}
                </button>
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
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

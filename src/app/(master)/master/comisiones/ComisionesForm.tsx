"use client";
import { useState, useTransition } from "react";

interface Branch    { id: string; name: string; monto: number; }
interface Asistente { id: string; name: string; phone: string; monto: number; }
interface Product   { id: string; name: string; branches: Branch[]; asistentes: Asistente[]; }

interface Props {
  products:        Product[];
  guardarProducto: (fd: FormData) => Promise<void>;
}

export function ComisionesForm({ products, guardarProducto }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving,   setSaving]   = useState<string | null>(null);
  const [saved,    setSaved]    = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(id: string) {
    setExpanded(prev => prev === id ? null : id);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>, productId: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(productId);
    startTransition(async () => {
      await guardarProducto(fd);
      setSaving(null);
      setSaved(productId);
      setTimeout(() => setSaved(prev => prev === productId ? null : prev), 2500);
    });
  }

  if (products.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-10 text-center">
        <p className="text-gray-400 text-sm">No hay productos activos</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {products.map(p => {
        const isOpen   = expanded === p.id;
        const isSaving = saving   === p.id;
        const isSaved  = saved    === p.id;

        return (
          <div key={p.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">

            {/* ── Cabecera accordion ── */}
            <button
              type="button"
              onClick={() => toggle(p.id)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
            >
              <span className="text-sm font-semibold text-gray-900">{p.name}</span>
              <span className="text-xs text-gray-400">{isOpen ? "▲" : "▼"}</span>
            </button>

            {/* ── Cuerpo ── */}
            {isOpen && (
              <form onSubmit={e => handleSubmit(e, p.id)}>
                <input type="hidden" name="product_id" value={p.id} />

                <div className="border-t border-gray-100">

                  {/* Sección 1 — Por sucursal */}
                  <div className="px-5 py-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Por sucursal</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Monto total a dividir entre las terapeutas de la sucursal al momento de la entrega
                      </p>
                    </div>
                    {p.branches.length === 0 ? (
                      <p className="text-xs text-gray-400">No hay sucursales activas</p>
                    ) : (
                      <div className="space-y-2.5">
                        {p.branches.map(b => (
                          <div key={b.id} className="flex items-center justify-between gap-4">
                            <span className="text-sm text-gray-700">{b.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-sm text-gray-400">$</span>
                              <input
                                type="number"
                                name={`suc_${b.id}`}
                                defaultValue={b.monto}
                                min="0"
                                step="0.01"
                                className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-right text-gray-900 bg-white focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sección 2 — Por asistente */}
                  <div className="px-5 py-4 space-y-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Por asistente</p>
                    {p.asistentes.length === 0 ? (
                      <p className="text-xs text-gray-400">No hay asistentes registrados</p>
                    ) : (
                      <div className="space-y-2.5">
                        {p.asistentes.map(a => (
                          <div key={a.id} className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm text-gray-700 truncate">{a.name}</p>
                              <p className="text-xs text-gray-400">{a.phone}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-sm text-gray-400">$</span>
                              <input
                                type="number"
                                name={`asis_${a.id}`}
                                defaultValue={a.monto}
                                min="0"
                                step="0.01"
                                className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-right text-gray-900 bg-white focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
                  {isSaved && <span className="text-sm text-green-600 font-medium">✓ Guardado</span>}
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
                  >
                    {isSaving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}

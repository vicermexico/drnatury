"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { QRConnector } from "./QRConnector";

interface WANumber {
  id: string;
  phone: string;
  is_active: boolean;
  display_order: number;
  last_used_at: string | null;
}

const MAX_NUMBERS = 4;

export function NumbersManager({ initial }: { initial: WANumber[] }) {
  const [numbers,      setNumbers]      = useState<WANumber[]>(initial);
  const [addingPhone,  setAddingPhone]  = useState("");
  const [showAdd,      setShowAdd]      = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error,        setError]        = useState("");
  const [isPending,    startTransition] = useTransition();
  const [liveStatus,   setLiveStatus]   = useState<Map<string, string>>(new Map());
  const submitting = useRef(false);

  // Consultar el estado real del servicio WAWEB al montar el componente
  useEffect(() => {
    fetch("/api/whatsapp-numbers/live-status")
      .then((r) => r.json())
      .then((data: { phone: string; status: string }[]) => {
        setLiveStatus(new Map(data.map((d) => [d.phone, d.status])));
      })
      .catch(() => { /* servicio no disponible — ignorar silenciosamente */ });
  }, []);

  function handleConnected(phone: string) {
    setLiveStatus((prev) => new Map(prev).set(phone, "CONNECTED"));
  }

  const sorted  = [...numbers].sort((a, b) => a.display_order - b.display_order);
  const canAdd  = numbers.length < MAX_NUMBERS;
  const connecting = connectingId ? numbers.find((n) => n.id === connectingId) : null;

  // ── Agregar ─────────────────────────────────────────────────
  function handleAdd() {
    const phone = addingPhone.replace(/\D/g, "");
    if (phone.length < 10) { setError("Ingresa 10 dígitos"); return; }
    if (submitting.current) return;
    submitting.current = true;
    setError("");

    startTransition(async () => {
      try {
        const res = await fetch("/api/whatsapp-numbers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.message ?? "Error al agregar"); return; }
        setNumbers((prev) => [...prev, data]);
        setAddingPhone("");
        setShowAdd(false);
      } finally {
        submitting.current = false;
      }
    });
  }

  // ── Toggle activo/inactivo ───────────────────────────────────
  function handleToggle(id: string, current: boolean) {
    startTransition(async () => {
      const res = await fetch(`/api/whatsapp-numbers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !current }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setNumbers((prev) => prev.map((n) => n.id === id ? { ...n, ...data } : n));
    });
  }

  // ── Eliminar ─────────────────────────────────────────────────
  function handleDelete(id: string) {
    if (connectingId === id) setConnectingId(null);
    startTransition(async () => {
      const res = await fetch(`/api/whatsapp-numbers/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setNumbers((prev) => prev.filter((n) => n.id !== id));
    });
  }

  return (
    <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Números de WhatsApp</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Rotación circular entre activos — primero el 1, luego el 2, y así.
          </p>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
          {numbers.length} / {MAX_NUMBERS}
        </span>
      </div>

      {/* Lista de números */}
      <div className="space-y-2">
        {sorted.map((n, i) => {
          const connStatus = liveStatus.get(n.phone);
          return (
          <div key={n.id} className="space-y-2">
            {/* Fila del número */}
            <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              {/* Posición */}
              <span className="text-xs font-bold text-gray-400 w-4 shrink-0">{i + 1}</span>

              {/* Teléfono */}
              <span className="text-sm font-medium text-gray-900 flex-1 font-mono">{n.phone}</span>

              {/* Indicador de estado de sesión WhatsApp */}
              {connStatus === "CONNECTED" && (
                <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Conectado
                </span>
              )}
              {(connStatus === "LOADING" || connStatus === "RECONNECTING") && (
                <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                  <span className="h-2 w-2 animate-spin rounded-full border border-blue-500 border-t-transparent" />
                  Reconectando
                </span>
              )}

              {/* Botón conectar QR */}
              <button
                type="button"
                onClick={() => setConnectingId(connectingId === n.id ? null : n.id)}
                className={`text-xs font-medium px-3 py-1 rounded-full transition ${
                  connectingId === n.id
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                }`}
              >
                {connectingId === n.id ? "Cerrar QR" : connStatus === "CONNECTED" ? "Ver QR" : "Conectar"}
              </button>

              {/* Toggle activo/inactivo */}
              <button
                type="button"
                onClick={() => handleToggle(n.id, n.is_active)}
                disabled={isPending}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  n.is_active
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${n.is_active ? "bg-green-500" : "bg-gray-300"}`} />
                {n.is_active ? "Activo" : "Inactivo"}
              </button>

              {/* Eliminar */}
              <button
                type="button"
                onClick={() => handleDelete(n.id)}
                disabled={isPending}
                className="text-gray-300 hover:text-red-500 transition text-lg leading-none"
                title="Eliminar número"
              >
                ×
              </button>
            </div>

            {/* Panel QR (inline, solo para el número seleccionado) */}
            {connectingId === n.id && (
              <QRConnector
                numberId={n.id}
                phone={n.phone}
                onClose={() => setConnectingId(null)}
                onConnected={handleConnected}
              />
            )}
          </div>
          );
        })}

        {/* Formulario de agregar */}
        {showAdd ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 space-y-3">
            <p className="text-xs font-medium text-blue-700">Nuevo número de WhatsApp</p>
            <div className="flex gap-2">
              <input
                type="tel"
                value={addingPhone}
                onChange={(e) => { setAddingPhone(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="10 dígitos"
                maxLength={10}
                inputMode="numeric"
                autoFocus
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <button type="button" onClick={handleAdd} disabled={isPending}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
                {isPending ? "…" : "Agregar"}
              </button>
              <button type="button" onClick={() => { setShowAdd(false); setError(""); setAddingPhone(""); }}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-white transition">
                Cancelar
              </button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        ) : canAdd ? (
          <button type="button" onClick={() => setShowAdd(true)}
            className="w-full rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-600 transition">
            + Agregar número
          </button>
        ) : null}
      </div>

      {numbers.length === 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          Sin números registrados. Los mensajes de WhatsApp solo se loguearán en consola hasta que agregues al menos uno.
        </p>
      )}

      {numbers.length > 0 && numbers.every((n) => !n.is_active) && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          Todos los números están inactivos. Activa al menos uno para enviar mensajes.
        </p>
      )}

      {/* Pantalla de QR a pantalla completa cuando hay número seleccionado */}
      {connecting && !sorted.find((n) => n.id === connecting.id) && null}
    </section>
  );
}

"use client";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { InventarioStatus } from "./page";

interface Producto { nombre: string; cantidad: number; }
interface Pedido {
  id: string;
  pedido_id: string;
  usuario_nombre: string;
  usuario_celular: string;
  productos: Producto[];
  total: number;
  total_tokens?: number | null;
  tipo: string;
  estado: string;
  separado: boolean;
  separado_at?: string | null;
  created_at: string;
  terapeuta_nombre?: string | null;
  entregado_at?: string | null;
}

interface Props {
  pedidos: Pedido[];
  inventarioStatus: Record<string, InventarioStatus>;
  terapeutaNombre: string;
}

export function PedidosBioredList({ pedidos, inventarioStatus }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"biored" | "biotokens">(() => {
    const t = searchParams.get("tab");
    return t === "biotokens" ? "biotokens" : "biored";
  });

  function changeTab(newTab: "biored" | "biotokens") {
    setTab(newTab);
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", newTab);
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  const byTipo = (tipo: "biored" | "biotokens") => pedidos.filter(p => p.tipo === tipo);
  const visible = byTipo(tab);

  const biored    = byTipo("biored");
  const biotokens = byTipo("biotokens");

  const bioredPendientes = biored.filter(p => p.estado === "pendiente");

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white p-1 gap-1">
        <TabBtn active={tab === "biored"} onClick={() => changeTab("biored")}
          label="BIORED" count={bioredPendientes.length} />
        <TabBtn active={tab === "biotokens"} onClick={() => changeTab("biotokens")}
          label="BioTokens" count={biotokens.filter(p => p.estado === "pendiente").length} />
      </div>

      {tab === "biotokens" ? (
        /* BioTokens: lista unificada sin separación, ordenada por fecha */
        <div className="space-y-3">
          {visible.length === 0 ? (
            <div className="rounded-2xl bg-white border border-dashed border-gray-200 p-6 text-center">
              <p className="text-gray-400 text-sm">Sin pedidos BioTokens</p>
            </div>
          ) : visible.map(p =>
            p.estado === "entregado"
              ? <EntregadoCard key={p.id} pedido={p} showEstadoBadge />
              : <PedidoCard key={p.id} pedido={p} inv={inventarioStatus[p.id] ?? { ok: true, faltantes: [] }} />
          )}
        </div>
      ) : (
        /* BIORED: lista unificada sin separación, ordenada por fecha */
        <div className="space-y-3">
          {visible.length === 0 ? (
            <div className="rounded-2xl bg-white border border-dashed border-gray-200 p-6 text-center">
              <p className="text-gray-400 text-sm">Sin pedidos BIORED</p>
            </div>
          ) : visible.map(p =>
            p.estado === "entregado"
              ? <EntregadoCard key={p.id} pedido={p} showEstadoBadge />
              : <PedidoCard key={p.id} pedido={p} inv={inventarioStatus[p.id] ?? { ok: true, faltantes: [] }} />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Helpers de layout ── */

function TabBtn({ active, onClick, label, count }: {
  active: boolean; onClick: () => void; label: string; count: number;
}) {
  return (
    <button onClick={onClick}
      className={`flex-1 text-center py-2 text-sm font-medium rounded-lg transition ${
        active ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
      }`}>
      {label}
      {count > 0 && (
        <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-gray-200"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function Section({ titulo, empty, emptyMsg, children }: {
  titulo: string; empty: boolean; emptyMsg: string; children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">{titulo}</h2>
      {empty ? (
        <div className="rounded-2xl bg-white border border-dashed border-gray-200 p-6 text-center">
          <p className="text-gray-400 text-sm">{emptyMsg}</p>
        </div>
      ) : children}
    </div>
  );
}

/* ── Tarjeta: pedido pendiente ── */

function PedidoCard({ pedido, inv }: { pedido: Pedido; inv: InventarioStatus }) {
  const [step, setStep] = useState<"idle" | "nip" | "loading-separar" | "loading-entregar">("idle");
  const [localSeparado, setLocalSeparado] = useState(pedido.separado);
  const [nip, setNip] = useState("");
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleSeparar() {
    setStep("loading-separar");
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/pedidos-biored/${pedido.id}/separar`, { method: "POST" });
      const data = await res.json() as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "Error al separar");
        setStep("idle");
        return;
      }
      setLocalSeparado(true);
      setStep("idle");
      router.refresh();
    });
  }

  function handleEntregar() { setStep("nip"); setError(""); setNip(""); }

  function handleConfirmar() {
    if (nip.length !== 4) { setError("El NIP debe ser de 4 dígitos"); return; }
    setStep("loading-entregar");
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/pedidos-biored/${pedido.id}/entregar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nip }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "Error al entregar");
        setStep("nip");
        return;
      }
      router.refresh();
    });
  }

  const tagColor = pedido.tipo === "biored"
    ? "bg-blue-50 text-blue-700"
    : "bg-purple-50 text-purple-700";

  // Badge de estado de inventario/separación
  let statusBadge: React.ReactNode;
  if (localSeparado) {
    statusBadge = (
      <span className="text-xs px-2 py-1 rounded-full font-medium bg-yellow-50 text-yellow-700">
        Mercancía separada
      </span>
    );
  } else if (inv.ok) {
    statusBadge = (
      <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-50 text-green-700">
        Listo para entregar
      </span>
    );
  } else {
    statusBadge = (
      <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-50 text-red-700">
        Falta inventario
      </span>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900">{pedido.usuario_nombre}</p>
          <p className="text-xs text-gray-500">{pedido.usuario_celular}</p>
          <p className="text-xs text-gray-400 mt-0.5">Pedido #{pedido.pedido_id}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${tagColor}`}>
            {pedido.tipo === "biored" ? "BIORED" : "BioTokens"}
          </span>
          {statusBadge}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Productos</p>
        {pedido.productos.map((p, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-gray-700">{p.nombre}</span>
            <span className="text-gray-500">x{p.cantidad}</span>
          </div>
        ))}
      </div>

      {!localSeparado && !inv.ok && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-3 space-y-1">
          <p className="text-xs font-semibold text-red-700">Productos insuficientes en sucursal:</p>
          {inv.faltantes.map((f, i) => (
            <div key={i} className="flex justify-between text-xs text-red-600">
              <span>{f.nombre}</span>
              <span>Tiene {f.tiene} · Necesita {f.necesita}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <p className="text-sm font-bold text-gray-900">
          {pedido.tipo === "biotokens"
            ? `${pedido.total_tokens ?? 0} tokens`
            : `$${pedido.total}`}
        </p>
      </div>

      {error && <p className="text-xs text-red-600 text-center">{error}</p>}

      {/* Botón: Separar mercancía */}
      {!localSeparado && inv.ok && step === "idle" && (
        <button onClick={handleSeparar}
          className="w-full rounded-xl bg-yellow-500 py-3 text-sm font-semibold text-white hover:bg-yellow-600 transition">
          Separar mercancía
        </button>
      )}

      {!localSeparado && inv.ok && step === "loading-separar" && (
        <div className="text-center py-2">
          <p className="text-sm text-gray-500">Separando...</p>
        </div>
      )}

      {/* Botón: Entregar con NIP (solo si ya está separado) */}
      {localSeparado && step === "idle" && (
        <button onClick={handleEntregar}
          className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 transition">
          Entregar con NIP
        </button>
      )}

      {localSeparado && step === "nip" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">NIP de entrega (4 dígitos)</label>
            <input
              type="number"
              value={nip}
              onChange={e => setNip(e.target.value.slice(0, 4))}
              placeholder="0000"
              style={{ color: "black" }}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-center tracking-widest bg-white focus:border-green-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-xs text-red-600 text-center">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setStep("idle")}
              className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button onClick={handleConfirmar}
              className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition">
              Confirmar
            </button>
          </div>
        </div>
      )}

      {localSeparado && step === "loading-entregar" && (
        <div className="text-center py-2">
          <p className="text-sm text-gray-500">Procesando entrega...</p>
        </div>
      )}
    </div>
  );
}

/* ── Tarjeta: pedido entregado ── */

function EntregadoCard({ pedido, showEstadoBadge }: { pedido: Pedido; showEstadoBadge?: boolean }) {
  const tagColor = pedido.tipo === "biored"
    ? "bg-blue-50 text-blue-700"
    : "bg-purple-50 text-purple-700";

  const fecha = pedido.entregado_at
    ? new Intl.DateTimeFormat("es-MX", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      }).format(new Date(pedido.entregado_at))
    : null;

  return (
    <div className="rounded-2xl bg-gray-50 border border-gray-200 p-5 space-y-3 opacity-80">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-700">{pedido.usuario_nombre}</p>
          <p className="text-xs text-gray-500">{pedido.usuario_celular}</p>
          <p className="text-xs text-gray-400 mt-0.5">Pedido #{pedido.pedido_id}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${tagColor}`}>
            {pedido.tipo === "biored" ? "BIORED" : "BioTokens"}
          </span>
          {showEstadoBadge && (
            <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-50 text-green-700">
              Entregado
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {pedido.productos.map((p, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-gray-600">{p.nombre}</span>
            <span className="text-gray-400">x{p.cantidad}</span>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-gray-200 flex flex-col gap-0.5">
        {fecha && (
          <p className="text-xs text-gray-500">Entregado el {fecha}</p>
        )}
        {pedido.terapeuta_nombre && (
          <p className="text-xs text-gray-500">Por: {pedido.terapeuta_nombre}</p>
        )}
      </div>
    </div>
  );
}

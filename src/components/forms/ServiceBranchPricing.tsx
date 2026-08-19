"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Branch { id: string; name: string; }
interface AssignedBranch { branch: Branch; price: number; simultaneous_capacity: number; }

interface Props {
  serviceId: string;
  assigned: AssignedBranch[];
  unassigned: Branch[];
}

function AssignedRow({ serviceId, branch, price, simultaneous_capacity }: {
  serviceId: string; branch: Branch; price: number; simultaneous_capacity: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"view" | "edit" | "confirm-remove">("view");
  const [editPrice, setEditPrice] = useState(String(price));
  const [editCapacity, setEditCapacity] = useState(String(simultaneous_capacity));
  const [error, setError] = useState("");

  function handleSave() {
    const num = parseFloat(editPrice);
    if (isNaN(num) || num < 0) { setError("Precio invalido"); return; }
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/branch-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branch.id,
          service_id: serviceId,
          price: num,
          simultaneous_capacity: parseInt(editCapacity, 10) || 1,
        }),
      });
      if (!res.ok) { setError("Error al guardar"); return; }
      setMode("view");
      router.refresh();
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const res = await fetch(
        `/api/branch-services?branch_id=${branch.id}&service_id=${serviceId}`,
        { method: "DELETE" }
      );
      if (!res.ok) { setError("Error al quitar"); return; }
      router.refresh();
    });
  }

  if (mode === "confirm-remove") {
    return (
      <div className="flex items-center justify-between rounded-xl bg-red-50 border border-red-200 px-4 py-3 gap-3">
        <p className="text-sm text-red-700 flex-1">Quitar <span className="font-semibold">{branch.name}</span>?</p>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setMode("view")} disabled={isPending}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-white transition">Cancelar</button>
          <button onClick={handleRemove} disabled={isPending}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-60">
            {isPending ? "..." : "Si, quitar"}
          </button>
        </div>
      </div>
    );
  }

  if (mode === "edit") {
    return (
      <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 space-y-3">
        <p className="text-sm font-medium text-gray-900">{branch.name}</p>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" min={0} step={0.01} autoFocus value={editPrice}
              onChange={e => setEditPrice(e.target.value)}
              className="w-full rounded-lg border border-blue-300 pl-6 pr-3 py-2 text-sm focus:outline-none" />
          </div>
          <select value={editCapacity} onChange={e => setEditCapacity(e.target.value)}
            className="rounded-lg border border-blue-300 px-3 py-2 text-sm focus:outline-none">
            <option value="1">x1</option>
            <option value="2">x2</option>
            <option value="3">x3</option>
            <option value="4">x4</option>
            <option value="5">x5</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={isPending}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60">
            {isPending ? "..." : "Guardar"}
          </button>
          <button onClick={() => { setMode("view"); setEditPrice(String(price)); setEditCapacity(String(simultaneous_capacity)); setError(""); }}
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-white transition">Cancelar</button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
      <span className="text-sm font-medium text-gray-900">{branch.name}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-900">
          ${price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
        </span>
        <span className="text-xs text-gray-400">x{simultaneous_capacity}</span>
        <button onClick={() => { setEditPrice(String(price)); setEditCapacity(String(simultaneous_capacity)); setMode("edit"); }}
          className="text-xs text-blue-600 hover:text-blue-800 transition">Editar</button>
        <button onClick={() => setMode("confirm-remove")}
          className="text-xs text-red-400 hover:text-red-600 transition">Quitar</button>
      </div>
    </div>
  );
}

function UnassignedRow({ serviceId, branch }: { serviceId: string; branch: Branch }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [error, setError] = useState("");

  function handleAdd() {
    const num = parseFloat(price);
    if (isNaN(num) || num < 0) { setError("Ingresa un precio valido"); return; }
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/branch-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branch.id,
          service_id: serviceId,
          price: num,
          simultaneous_capacity: parseInt(capacity, 10) || 1,
        }),
      });
      if (!res.ok) { setError("Error al agregar"); return; }
      setOpen(false); setPrice(""); setCapacity("1");
      router.refresh();
    });
  }

  if (open) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 space-y-3">
        <p className="text-sm font-medium text-gray-700">{branch.name}</p>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" min={0} step={0.01} autoFocus value={price} placeholder="0.00"
              onChange={e => setPrice(e.target.value)}
              className="w-full rounded-lg border border-green-300 pl-6 pr-3 py-2 text-sm focus:outline-none" />
          </div>
          <select value={capacity} onChange={e => setCapacity(e.target.value)}
            className="rounded-lg border border-green-300 px-3 py-2 text-sm focus:outline-none">
            <option value="1">x1</option>
            <option value="2">x2</option>
            <option value="3">x3</option>
            <option value="4">x4</option>
            <option value="5">x5</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAdd} disabled={isPending}
            className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition disabled:opacity-60">
            {isPending ? "..." : "Agregar"}
          </button>
          <button onClick={() => { setOpen(false); setPrice(""); setError(""); }}
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-white transition">Cancelar</button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-dashed border-gray-200 px-4 py-3">
      <span className="text-sm text-gray-400">{branch.name}</span>
      <button onClick={() => setOpen(true)} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition">
        + Agregar precio
      </button>
    </div>
  );
}

export function ServiceBranchPricing({ serviceId, assigned, unassigned }: Props) {
  const allEmpty = assigned.length === 0 && unassigned.length === 0;
  if (allEmpty) {
    return (
      <p className="text-sm text-gray-400">
        No hay sucursales activas.{" "}
        <a href="/master/sucursales" className="text-blue-600 hover:underline">Crear sucursal</a>
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {assigned.map((bs) => (
        <AssignedRow key={bs.branch.id} serviceId={serviceId} branch={bs.branch}
          price={bs.price} simultaneous_capacity={bs.simultaneous_capacity} />
      ))}
      {unassigned.map((branch) => (
        <UnassignedRow key={branch.id} serviceId={serviceId} branch={branch} />
      ))}
    </div>
  );
}

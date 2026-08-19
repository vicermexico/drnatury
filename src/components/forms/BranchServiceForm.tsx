"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
}

interface Props {
  branchId: string;
  availableServices: Service[];
}

export function BranchServiceForm({ branchId, availableServices }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("1");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/branch-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          service_id: serviceId,
          price: parseFloat(price),
          simultaneous_capacity: parseInt(capacity, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Error al agregar el servicio");
        return;
      }
      setServiceId("");
      setPrice("");
      setCapacity("1");
      router.refresh();
    });
  }

  async function removeService(svcId: string) {
    const res = await fetch(
      `/api/branch-services?branch_id=${branchId}&service_id=${svcId}`,
      { method: "DELETE" }
    );
    if (res.ok) router.refresh();
  }

  if (availableServices.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Todos los servicios ya estan asignados a esta sucursal o no hay servicios creados.{" "}
        <a href="/master/servicios/nuevo" className="text-blue-600 underline">Crear servicio</a>
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <select required value={serviceId} onChange={(e) => setServiceId(e.target.value)}
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
          <option value="">Seleccionar servicio</option>
          {availableServices.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>
          ))}
        </select>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input type="number" required min={0} step={0.01} value={price}
            onChange={(e) => setPrice(e.target.value)} placeholder="Precio"
            className="w-28 rounded-xl border border-gray-300 pl-6 pr-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <select value={capacity} onChange={(e) => setCapacity(e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
          <option value="1">x1</option>
          <option value="2">x2</option>
          <option value="3">x3</option>
          <option value="4">x4</option>
          <option value="5">x5</option>
        </select>
        <button type="submit" disabled={isPending}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-60">
          {isPending ? "..." : "Agregar"}
        </button>
      </div>
      <p className="text-xs text-gray-400">x1 = 1 persona a la vez, x2 = 2 al mismo tiempo, etc.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

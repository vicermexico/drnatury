"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const DURATIONS = [
  { value: 30,  label: "30 min" },
  { value: 60,  label: "1 hora" },
  { value: 90,  label: "1:30 horas" },
  { value: 120, label: "2 horas" },
  { value: 150, label: "2:30 horas" },
  { value: 180, label: "3 horas" },
];

interface Branch { id: string; name: string; }
interface BranchConfig { price: string; capacity: string; }

export function ServiceForm({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("60");

  const initialBranchConfigs = Object.fromEntries(
    branches.map(b => [b.id, { price: "", capacity: "1" }])
  );
  const [branchConfigs, setBranchConfigs] = useState<Record<string, BranchConfig>>(initialBranchConfigs);

  function updateBranch(branchId: string, field: keyof BranchConfig, value: string) {
    setBranchConfigs(prev => ({
      ...prev,
      [branchId]: { ...prev[branchId], [field]: value }
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          duration_minutes: parseInt(duration, 10),
          simultaneous_capacity: 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Error al crear el servicio"); return; }

      const serviceId = data.id;

      // Asignar precio y capacidad a sucursales que tengan precio
      const branchPromises = branches
        .filter(b => branchConfigs[b.id]?.price !== "")
        .map(b => fetch("/api/branch-services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branch_id: b.id,
            service_id: serviceId,
            price: parseFloat(branchConfigs[b.id].price) || 0,
            simultaneous_capacity: parseInt(branchConfigs[b.id].capacity, 10) || 1,
          }),
        }));

      await Promise.all(branchPromises);
      router.push("/master/servicios");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className={lc}>Nombre del servicio *</label>
        <input type="text" required value={name} onChange={e => setName(e.target.value)}
          placeholder="Ej: Biomagnetismo" className={ic} />
      </div>

      <div>
        <label className={lc}>Duracion *</label>
        <p className="text-xs text-gray-400 mb-1">La duracion determina cuantos bloques de 30 min ocupa en la agenda</p>
        <div className="grid grid-cols-3 gap-2">
          {DURATIONS.map(({ value, label }) => (
            <button key={value} type="button" onClick={() => setDuration(String(value))}
              className={["rounded-xl border px-3 py-3 text-sm font-medium transition",
                String(value) === duration ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300",
              ].join(" ")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {branches.length > 0 && (
        <div>
          <label className={lc}>Precio y capacidad por sucursal</label>
          <p className="text-xs text-gray-400 mb-2">Deja el precio vacio si no quieres asignar el servicio a esa sucursal</p>
          <div className="space-y-3">
            {branches.map(b => (
              <div key={b.id} className="rounded-xl border border-gray-200 p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-800">{b.name}</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" min={0} step={0.01}
                      value={branchConfigs[b.id]?.price ?? ""}
                      onChange={e => updateBranch(b.id, "price", e.target.value)}
                      placeholder="Precio (opcional)"
                      style={{ color: "black" }}
                      className="w-full rounded-lg border border-gray-300 pl-6 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                  <select value={branchConfigs[b.id]?.capacity ?? "1"}
                    onChange={e => updateBranch(b.id, "capacity", e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                    <option value="1">x1</option>
                    <option value="2">x2</option>
                    <option value="3">x3</option>
                    <option value="4">x4</option>
                    <option value="5">x5</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()}
          className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          Cancelar
        </button>
        <button type="submit" disabled={isPending}
          className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {isPending ? "Guardando..." : "Crear servicio"}
        </button>
      </div>
    </form>
  );
}

const lc = "block text-sm font-medium text-gray-700 mb-1";
const ic = "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ChoferForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", phone: "", pin: "", confirm_pin: "",
  });

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.pin !== form.confirm_pin) {
      setError("Los PIN no coinciden");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/choferes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          pin: form.pin,
        }),
      });
      const data = await res.json() as { message?: string };
      if (res.status === 409) { setError("Este número de celular ya está registrado"); return; }
      if (!res.ok) { setError(data.message ?? "Error al crear el chofer"); return; }
      router.push("/master/choferes");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={lc}>Nombre completo *</label>
        <input required value={form.name} onChange={e => set("name", e.target.value)} className={ic} />
      </div>
      <div>
        <label className={lc}>Número de celular *</label>
        <input
          type="tel" inputMode="numeric" required
          value={form.phone}
          onChange={e => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="10 dígitos" className={ic}
        />
      </div>
      <div>
        <label className={lc}>PIN de acceso (6 dígitos) *</label>
        <p className="text-xs text-gray-400 mb-1">
          El chofer usará su celular y este PIN para entrar a su panel de entregas
        </p>
        <input type="password" inputMode="numeric" required pattern="\d{6}" maxLength={6}
          value={form.pin} onChange={e => set("pin", e.target.value.replace(/\D/g, "").slice(0, 6))} className={ic} />
      </div>
      <div>
        <label className={lc}>Confirmar PIN *</label>
        <input type="password" inputMode="numeric" required pattern="\d{6}" maxLength={6}
          value={form.confirm_pin} onChange={e => set("confirm_pin", e.target.value.replace(/\D/g, "").slice(0, 6))} className={ic} />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()}
          className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          Cancelar
        </button>
        <button type="submit" disabled={isPending}
          className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {isPending ? "Guardando…" : "Crear chofer"}
        </button>
      </div>
    </form>
  );
}

const lc = "block text-sm font-medium text-gray-700 mb-1";
const ic = "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

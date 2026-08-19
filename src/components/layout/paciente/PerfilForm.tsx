"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  name: string;
  phone: string;
  city: string;
}

export function PerfilForm({ id, name, phone, city }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({ name, phone, city });
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit() {
    setStatus("loading");
    setError("");

    const res = await fetch(`/api/perfil`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...form }),
    });

    if (res.ok) {
      setStatus("ok");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({})) as { message?: string };
      setError(data.message ?? "Error al guardar. Intenta de nuevo.");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Nombre completo
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-blue-400"
            placeholder="Tu nombre"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Celular
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-blue-400"
            placeholder="Tu número de celular"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Ciudad
          </label>
          <input
            type="text"
            value={form.city}
            onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-blue-400"
            placeholder="Tu ciudad"
          />
        </div>
      </div>

      {status === "ok" && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
          <p className="text-sm text-green-700 font-medium">✅ Perfil actualizado</p>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={status === "loading"}
        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60"
      >
        {status === "loading" ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
}

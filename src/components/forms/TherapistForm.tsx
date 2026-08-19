"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Branch {
  id: string;
  name: string;
}

interface Props {
  branches: Branch[];
}

export function TherapistForm({ branches }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    branch_id: "",
    password: "",
    confirm_password: "",
  });

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm_password) {
      setError("Las contraseñas no coinciden");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/therapists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          branch_id: form.branch_id,
          password: form.password,
        }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setError("Este número de celular ya está registrado en el sistema");
        return;
      }
      if (!res.ok) {
        setError(data.message ?? "Error al crear la terapeuta");
        return;
      }

      router.push("/master/terapeutas");
    });
  }

  if (branches.length === 0) {
    return (
      <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-5 text-sm text-yellow-800">
        Primero debes dar de alta al menos una sucursal antes de registrar terapeutas.{" "}
        <a href="/master/sucursales/nueva" className="underline font-medium">
          Crear sucursal
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Nombre completo *</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Número de celular *</label>
        <input
          type="tel"
          inputMode="numeric"
          required
          value={form.phone}
          onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="10 dígitos"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Correo electrónico</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="Opcional"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Sucursal asignada *</label>
        <select
          required
          value={form.branch_id}
          onChange={(e) => set("branch_id", e.target.value)}
          className={inputClass}
        >
          <option value="">Seleccionar sucursal</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Contraseña de acceso *</label>
        <p className="text-xs text-gray-400 mb-1">
          La terapeuta usará esta contraseña junto con su número de celular para entrar
        </p>
        <input
          type="password"
          required
          minLength={6}
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Confirmar contraseña *</label>
        <input
          type="password"
          required
          value={form.confirm_password}
          onChange={(e) => set("confirm_password", e.target.value)}
          className={inputClass}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60"
        >
          {isPending ? "Guardando…" : "Crear terapeuta"}
        </button>
      </div>
    </form>
  );
}

const labelClass = "block text-sm font-medium text-gray-700 mb-1";
const inputClass =
  "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

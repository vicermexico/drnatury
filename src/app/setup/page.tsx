"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const name = form.get("name") as string;
    const phone = form.get("phone") as string;
    const password = form.get("password") as string;

    startTransition(async () => {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError("La cuenta Master ya existe. Ve al login.");
          return;
        }
        setError(data.message ?? "Error al crear la cuenta");
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    });
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center space-y-3">
          <div className="text-5xl">✅</div>
          <p className="text-xl font-semibold text-gray-900">Cuenta creada</p>
          <p className="text-sm text-gray-500">Redirigiendo al login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">DrNatury</p>
          <p className="text-sm text-gray-500 mt-2">Configuración inicial — cuenta Master</p>
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">
            Esta página solo funciona una vez. Después queda deshabilitada.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nombre completo
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="Alejandro Cervantes Elizondo"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Número de celular (10 dígitos)
            </label>
            <input
              name="phone"
              type="tel"
              required
              placeholder="8112345678"
              maxLength={15}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Contraseña (mínimo 8 caracteres)
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60"
          >
            {isPending ? "Creando cuenta…" : "Crear cuenta Master"}
          </button>
        </form>
      </div>
    </div>
  );
}

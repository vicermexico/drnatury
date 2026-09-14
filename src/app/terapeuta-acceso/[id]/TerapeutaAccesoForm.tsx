"use client";
import { useState, useTransition } from "react";

export function TerapeutaAccesoForm({ therapistId, next }: { therapistId: string; next: string | null }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) { setError("Escribe tu contraseña"); return; }
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/auth/login-terapeuta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ therapistId, password, next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { setError("Contraseña incorrecta"); return; }
      if (res.status === 429) { setError(data.message ?? "Espera un momento."); return; }
      if (!res.ok) { setError("No se pudo entrar. Intenta de nuevo."); return; }
      // Navegacion completa para que el middleware reciba las cookies de sesion.
      window.location.href = data.nextPath;
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
        <input
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-emerald-400 py-3 text-base font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
      >
        {isPending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

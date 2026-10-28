"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function DesconectarButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  function handleDesconectar() {
    startTransition(async () => {
      await fetch("/api/google-calendar/disconnect", { method: "POST" });
      router.refresh();
    });
  }

  if (!confirmando) {
    return (
      <button onClick={() => setConfirmando(true)}
        className="text-sm text-red-600 hover:text-red-800 font-medium underline">
        Desconectar
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-sm text-gray-600">¿Seguro?</p>
      <button onClick={handleDesconectar} disabled={isPending}
        className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition disabled:opacity-60">
        {isPending ? "Desconectando..." : "Sí, desconectar"}
      </button>
      <button onClick={() => setConfirmando(false)}
        className="text-xs text-gray-400 hover:text-gray-600">
        Cancelar
      </button>
    </div>
  );
}

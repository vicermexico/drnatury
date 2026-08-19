"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/inicio");
    });
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isPending}
      className="w-full text-left px-3 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
    >
      {isPending ? "Saliendo..." : "Cerrar sesion"}
    </button>
  );
}

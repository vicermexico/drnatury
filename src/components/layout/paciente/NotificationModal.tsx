"use client";
import { useState, useEffect } from "react";
import { requestNotificationPermission } from "@/lib/firebase";
const DISMISS_KEY = "drnatury_notif_prompt_dismissed";
export function NotificationModal() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    // Solo se muestra si el navegador soporta notificaciones y el paciente
    // todavia no ha decidido (no estan activas ni las rechazo antes).
    if (Notification.permission !== "default") return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    // Pequena pausa para que no aparezca de golpe al abrir la pantalla.
    const t = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(t);
  }, []);
  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }
  async function handleActivate() {
    setLoading(true);
    const token = await requestNotificationPermission();
    if (token) {
      await fetch("/api/notifications/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    }
    setLoading(false);
    setShow(false);
  }
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 px-4 pb-6 sm:pb-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 space-y-4 shadow-2xl animate-[fadeUp_0.25s_ease-out]">
        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-3xl">
          🔔
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-gray-900">Activa tus notificaciones</h2>
          <p className="text-sm text-gray-500">
            Te avisamos a tiempo antes de cada cita para que no se te olvide.
          </p>
        </div>
        <div className="space-y-2">
          <button
            onClick={handleActivate}
            disabled={loading}
            className="w-full rounded-xl bg-emerald-400 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-60"
          >
            {loading ? "Activando..." : "Activar notificaciones"}
          </button>
          <button
            onClick={dismiss}
            className="w-full text-sm text-gray-400 hover:text-gray-600 py-1.5 transition"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { requestNotificationPermission } from "@/lib/firebase";

// Para que a Master le llegue el push de "Apoyo con Cliente" (cuando
// al bot se le complica una conversacion) aunque tenga el celular
// bloqueado o el navegador cerrado -- mismo mecanismo que ya usan los
// pacientes (ver NotificacionesButton.tsx), nada mas que guarda el
// push_token en el MISMO renglon de "profiles" de quien esta
// conectado (el endpoint /api/notifications/token ya funciona para
// cualquier usuario logueado, no solo pacientes).
export function ActivarNotificacionesApoyo() {
  const [status, setStatus] = useState<"idle" | "loading" | "granted" | "denied" | "default">("default");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setStatus("denied");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    if (Notification.permission === "granted") {
      requestNotificationPermission().then((token) => {
        if (token) {
          fetch("/api/notifications/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          setStatus("granted");
        }
      });
    }
  }, []);

  async function activar() {
    if (!("Notification" in window)) {
      setStatus("denied");
      return;
    }
    setStatus("loading");
    const token = await requestNotificationPermission();
    if (token) {
      setStatus("granted");
      await fetch("/api/notifications/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    } else {
      setStatus("denied");
    }
  }

  if (status === "granted") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
        <span className="text-green-600">🔔</span>
        <p className="text-sm text-green-700 font-medium">
          Notificaciones de &quot;Apoyo con Cliente&quot; activadas
        </p>
      </div>
    );
  }
  if (status === "denied") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3">
        <span>🔕</span>
        <p className="text-sm text-rose-600">Notificaciones no disponibles en este dispositivo</p>
      </div>
    );
  }
  return (
    <button
      onClick={activar}
      disabled={status === "loading"}
      className="w-full flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 hover:bg-amber-100 transition"
    >
      <span>🔔</span>
      <p className="text-sm text-amber-700 font-medium">
        {status === "loading"
          ? "Activando..."
          : "Activar notificación de \"Apoyo con Cliente\" (te avisa cuando el bot se complica)"}
      </p>
    </button>
  );
}

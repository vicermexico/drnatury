"use client";

import { useState, useEffect } from "react";
import { requestNotificationPermission } from "@/lib/firebase";

export function NotificacionesButton() {
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

  async function handleClick() {
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
        <p className="text-sm text-green-700 font-medium">Notificaciones activadas</p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
        <span>🔕</span>
        <p className="text-sm text-red-700">Notificaciones no disponibles en este dispositivo</p>
      </div>
    );
  }

  

  return (
    <button
      onClick={handleClick}
      disabled={status === "loading"}
      className="w-full flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 hover:bg-blue-100 transition"
    >
      <span>🔔</span>
      <p className="text-sm text-blue-700 font-medium">
        {status === "loading" ? "Activando..." : "Activar notificaciones"}
      </p>
    </button>
  );
}



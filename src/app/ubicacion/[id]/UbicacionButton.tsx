"use client";
import { useState } from "react";

export function UbicacionButton({ appointmentId, token }: { appointmentId: string; token: string }) {
  const [estado, setEstado] = useState<"inicio" | "cargando" | "listo" | "error">("inicio");
  const [mensajeError, setMensajeError] = useState("");

  function compartirUbicacion() {
    if (!("geolocation" in navigator)) {
      setEstado("error");
      setMensajeError("Tu celular no permite compartir ubicación desde aquí. Intenta desde Chrome o Safari.");
      return;
    }
    setEstado("cargando");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/appointments/${appointmentId}/ubicacion`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          });
          if (!res.ok) {
            setEstado("error");
            setMensajeError("No se pudo guardar. Intenta de nuevo.");
            return;
          }
          setEstado("listo");
        } catch {
          setEstado("error");
          setMensajeError("No se pudo guardar. Intenta de nuevo.");
        }
      },
      () => {
        setEstado("error");
        setMensajeError("No se pudo obtener tu ubicación. Revisa que le hayas dado permiso a tu navegador.");
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  if (estado === "listo") {
    return (
      <div className="rounded-2xl bg-green-50 border border-green-200 p-5 text-center space-y-1">
        <p className="text-2xl">✅</p>
        <p className="text-sm font-semibold text-green-700">¡Ubicación enviada!</p>
        <p className="text-xs text-green-600">Ya sabemos exactamente dónde llegar. Gracias.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={compartirUbicacion}
        disabled={estado === "cargando"}
        className="w-full rounded-xl bg-red-600 py-3.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-60"
      >
        {estado === "cargando" ? "Obteniendo ubicación…" : "📍 Compartir mi ubicación actual"}
      </button>
      {estado === "error" && (
        <p className="text-sm text-red-600 text-center">{mensajeError}</p>
      )}
    </div>
  );
}

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
      <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 p-6 text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center text-2xl text-white shadow-md">
          ✓
        </div>
        <p className="text-base font-bold text-emerald-700">¡Ubicación enviada!</p>
        <p className="text-xs text-emerald-600">Ya sabemos exactamente dónde llegar. Nos vemos pronto 🙌</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={compartirUbicacion}
        disabled={estado === "cargando"}
        className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-4 text-sm font-bold text-white shadow-md shadow-emerald-200 hover:shadow-lg hover:brightness-105 transition disabled:opacity-70 disabled:cursor-wait"
      >
        <span className="relative flex items-center justify-center gap-2">
          {estado === "cargando" ? (
            <>
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Obteniendo tu ubicación…
            </>
          ) : (
            <>📍 Compartir mi ubicación actual</>
          )}
        </span>
      </button>
      {estado === "error" && (
        <p className="text-sm text-red-600 text-center bg-red-50 border border-red-100 rounded-xl px-3 py-2">{mensajeError}</p>
      )}
    </div>
  );
}

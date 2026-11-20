"use client";
import { useEffect, useState } from "react";

interface UbicacionUI {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  updated_at: string;
}

// Para guardar la ubicacion de un lugar, Master tiene que estar FISICAMENTE
// parado ahi con su celular (usa el GPS real del celular, no se puede
// escribir a mano) -- asi el bot manda despues el pin exacto, no una
// direccion aproximada.
export function UbicacionesManager() {
  const [ubicaciones, setUbicaciones] = useState<UbicacionUI[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [guardandoNombre, setGuardandoNombre] = useState<string | null>(null);
  const [errorGuardando, setErrorGuardando] = useState<{ nombre: string; mensaje: string } | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch("/api/master/bot-demo/ubicaciones");
      const data = await res.json().catch(() => null);
      setUbicaciones(data?.ubicaciones ?? []);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function guardarUbicacionDe(nombre: string) {
    const limpio = nombre.trim();
    if (!limpio || guardandoNombre) return;
    if (!("geolocation" in navigator)) {
      setErrorGuardando({ nombre: limpio, mensaje: "Tu celular no permite compartir ubicación desde aquí. Intenta desde Chrome o Safari." });
      return;
    }
    setErrorGuardando(null);
    setGuardandoNombre(limpio);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch("/api/master/bot-demo/ubicaciones", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nombre: limpio,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          });
          if (!res.ok) {
            setErrorGuardando({ nombre: limpio, mensaje: "No se pudo guardar. Intenta de nuevo." });
            return;
          }
          setNombreNuevo("");
          await cargar();
        } catch {
          setErrorGuardando({ nombre: limpio, mensaje: "No se pudo guardar. Intenta de nuevo." });
        } finally {
          setGuardandoNombre(null);
        }
      },
      () => {
        setErrorGuardando({ nombre: limpio, mensaje: "No se pudo obtener tu ubicación. Revisa que le hayas dado permiso a tu navegador." });
        setGuardandoNombre(null);
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  async function borrar(id: string) {
    setBorrandoId(id);
    try {
      const res = await fetch("/api/master/bot-demo/ubicaciones", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setUbicaciones((prev) => prev.filter((u) => u.id !== id));
      }
    } finally {
      setBorrandoId(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Tienes que estar físicamente parado en el consultorio para guardar su ubicación (usa el GPS real
        de tu celular). El bot manda ese pin exacto cuando alguien pide &quot;la ubicación&quot; o
        &quot;la dirección&quot; de ese lugar.
      </p>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
        <p className="text-sm font-medium text-gray-700">📍 Guardar un lugar nuevo</p>
        <div className="flex gap-2">
          <input
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            placeholder='Nombre del lugar, ej. "San Blas"'
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            onClick={() => guardarUbicacionDe(nombreNuevo)}
            disabled={!nombreNuevo.trim() || guardandoNombre === nombreNuevo.trim()}
            className="text-xs px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
          >
            {guardandoNombre === nombreNuevo.trim() ? "Obteniendo ubicación..." : "Guardar mi ubicación aquí"}
          </button>
        </div>
        {errorGuardando && errorGuardando.nombre === nombreNuevo.trim() && (
          <p className="text-xs text-red-600">{errorGuardando.mensaje}</p>
        )}
      </div>

      <div className="space-y-2">
        {cargando && <p className="text-xs text-gray-400">Cargando...</p>}
        {!cargando && ubicaciones.length === 0 && (
          <p className="text-xs text-gray-400">Todavía no has guardado ninguna ubicación.</p>
        )}
        {ubicaciones.map((u) => (
          <div key={u.id} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-900">📍 {u.nombre}</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${u.lat},${u.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Ver en Google Maps
                </a>
              </div>
              <button
                onClick={() => borrar(u.id)}
                disabled={borrandoId === u.id}
                className="text-[11px] text-gray-400 hover:text-red-600 disabled:opacity-50 shrink-0"
              >
                {borrandoId === u.id ? "..." : "🗑️"}
              </button>
            </div>
            <button
              onClick={() => guardarUbicacionDe(u.nombre)}
              disabled={guardandoNombre === u.nombre}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {guardandoNombre === u.nombre ? "Obteniendo ubicación..." : "Actualizar parado aquí"}
            </button>
            {errorGuardando && errorGuardando.nombre === u.nombre && (
              <p className="text-xs text-red-600">{errorGuardando.mensaje}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

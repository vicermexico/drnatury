"use client";
import { useEffect, useState } from "react";

interface UbicacionUI {
  id: string;
  nombre: string;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  updated_at: string;
}

function linkMapa(u: { direccion: string | null; lat: number | null; lng: number | null }): string | null {
  if (u.lat != null && u.lng != null) return `https://www.google.com/maps/search/?api=1&query=${u.lat},${u.lng}`;
  if (u.direccion) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(u.direccion)}`;
  return null;
}

// Guardar un lugar: se puede escribir la direccion a mano (no hace
// falta estar ahi), o -- si Master esta parado fisicamente en el
// consultorio -- guardar tambien el GPS exacto de su celular, para un
// pin mas preciso. Se puede usar cualquiera de los dos, o los dos.
export function UbicacionesManager() {
  const [ubicaciones, setUbicaciones] = useState<UbicacionUI[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [direccionNueva, setDireccionNueva] = useState("");
  const [guardandoTexto, setGuardandoTexto] = useState(false);
  const [guardandoGpsDe, setGuardandoGpsDe] = useState<string | null>(null);
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

  async function guardarTexto() {
    const nombre = nombreNuevo.trim();
    const direccion = direccionNueva.trim();
    if (!nombre || !direccion || guardandoTexto) return;
    setErrorGuardando(null);
    setGuardandoTexto(true);
    try {
      const res = await fetch("/api/master/bot-demo/ubicaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, direccion }),
      });
      if (!res.ok) {
        setErrorGuardando({ nombre, mensaje: "No se pudo guardar. Intenta de nuevo." });
        return;
      }
      setNombreNuevo("");
      setDireccionNueva("");
      await cargar();
    } catch {
      setErrorGuardando({ nombre, mensaje: "No se pudo guardar. Intenta de nuevo." });
    } finally {
      setGuardandoTexto(false);
    }
  }

  function guardarGpsDe(nombre: string) {
    const limpio = nombre.trim();
    if (!limpio || guardandoGpsDe) return;
    if (!("geolocation" in navigator)) {
      setErrorGuardando({ nombre: limpio, mensaje: "Tu celular no permite compartir ubicación desde aquí. Intenta desde Chrome o Safari." });
      return;
    }
    setErrorGuardando(null);
    setGuardandoGpsDe(limpio);
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
          await cargar();
        } catch {
          setErrorGuardando({ nombre: limpio, mensaje: "No se pudo guardar. Intenta de nuevo." });
        } finally {
          setGuardandoGpsDe(null);
        }
      },
      () => {
        setErrorGuardando({ nombre: limpio, mensaje: "No se pudo obtener tu ubicación. Revisa que le hayas dado permiso a tu navegador." });
        setGuardandoGpsDe(null);
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
        Escribe la dirección de cada lugar (no hace falta estar ahí). Si además quieres un pin más
        exacto, puedes pararte físicamente en el consultorio y guardar el GPS real de tu celular. El bot
        manda esta información cuando alguien pide &quot;la ubicación&quot; o &quot;la dirección&quot;.
      </p>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
        <p className="text-sm font-medium text-gray-700">📍 Guardar un lugar nuevo</p>
        <input
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          placeholder='Nombre del lugar, ej. "San Blas"'
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <textarea
          value={direccionNueva}
          onChange={(e) => setDireccionNueva(e.target.value)}
          rows={2}
          placeholder="Dirección completa"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <button
          onClick={guardarTexto}
          disabled={!nombreNuevo.trim() || !direccionNueva.trim() || guardandoTexto}
          className="text-xs px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {guardandoTexto ? "Guardando..." : "+ Guardar lugar"}
        </button>
        {errorGuardando && errorGuardando.nombre === nombreNuevo.trim() && (
          <p className="text-xs text-red-600">{errorGuardando.mensaje}</p>
        )}
      </div>

      <div className="space-y-2">
        {cargando && <p className="text-xs text-gray-400">Cargando...</p>}
        {!cargando && ubicaciones.length === 0 && (
          <p className="text-xs text-gray-400">Todavía no has guardado ninguna ubicación.</p>
        )}
        {ubicaciones.map((u) => {
          const link = linkMapa(u);
          return (
            <div key={u.id} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">📍 {u.nombre}</p>
                  {u.direccion && <p className="text-xs text-gray-600 mt-0.5">{u.direccion}</p>}
                  {link && (
                    <a href={link} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                      Ver en Google Maps
                    </a>
                  )}
                  {u.lat != null && u.lng != null && (
                    <p className="text-[11px] text-gray-400 mt-0.5">Con GPS guardado (pin exacto)</p>
                  )}
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
                onClick={() => guardarGpsDe(u.nombre)}
                disabled={guardandoGpsDe === u.nombre}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {guardandoGpsDe === u.nombre
                  ? "Obteniendo ubicación..."
                  : u.lat != null
                    ? "Actualizar GPS parado aquí"
                    : "📍 Agregar GPS parado aquí (opcional)"}
              </button>
              {errorGuardando && errorGuardando.nombre === u.nombre && (
                <p className="text-xs text-red-600">{errorGuardando.mensaje}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

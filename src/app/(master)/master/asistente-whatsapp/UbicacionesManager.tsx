"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface UbicacionUI {
  id: string;
  nombre: string;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  audio_url: string | null;
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
  // Grabacion del audio de orientacion: se graba directo con el
  // microfono del celular (no se sube un archivo ya existente), igual
  // que una nota de voz de WhatsApp -- "grabandoNombre" es el nombre
  // del lugar que se esta grabando en este momento (null si no hay
  // ninguna grabacion activa).
  const [grabandoNombre, setGrabandoNombre] = useState<string | null>(null);
  const [subiendoAudioDe, setSubiendoAudioDe] = useState<string | null>(null);
  const grabadoraRef = useRef<MediaRecorder | null>(null);
  const trozosRef = useRef<Blob[]>([]);

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

  async function subirAudioDe(nombre: string, blob: Blob) {
    setSubiendoAudioDe(nombre);
    try {
      const extension = blob.type.includes("mp4") ? "m4a" : "webm";
      const res = await fetch("/api/master/bot-demo/ubicaciones/audio-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: `${nombre}.${extension}` }),
      });
      const data = (await res.json()) as { path?: string; token?: string; publicUrl?: string; message?: string };
      if (!res.ok || !data.path || !data.token || !data.publicUrl) {
        throw new Error(data.message || "No se pudo iniciar la subida");
      }

      const supabase = createClient();
      const { error: uploadErr } = await supabase.storage
        .from("whatsapp-bot-bienvenida")
        .uploadToSignedUrl(data.path, data.token, blob, { contentType: blob.type });
      if (uploadErr) throw new Error(uploadErr.message);

      const res2 = await fetch("/api/master/bot-demo/ubicaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, audio_url: data.publicUrl }),
      });
      if (!res2.ok) throw new Error("No se pudo guardar");
      await cargar();
    } catch {
      setErrorGuardando({ nombre, mensaje: "No se pudo guardar el audio, intenta de nuevo." });
    } finally {
      setSubiendoAudioDe(null);
    }
  }

  async function grabarAudioDe(nombre: string) {
    if (grabandoNombre || subiendoAudioDe) return;
    if (!("mediaDevices" in navigator) || !navigator.mediaDevices?.getUserMedia) {
      setErrorGuardando({ nombre, mensaje: "Tu celular no permite grabar audio desde aquí. Intenta desde Chrome o Safari." });
      return;
    }
    setErrorGuardando(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm";
      const grabadora = new MediaRecorder(stream, { mimeType: mime });
      trozosRef.current = [];
      grabadora.ondataavailable = (e) => {
        if (e.data.size > 0) trozosRef.current.push(e.data);
      };
      grabadora.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(trozosRef.current, { type: mime });
        trozosRef.current = [];
        void subirAudioDe(nombre, blob);
      };
      grabadoraRef.current = grabadora;
      grabadora.start();
      setGrabandoNombre(nombre);
    } catch {
      setErrorGuardando({ nombre, mensaje: "No se pudo acceder al micrófono. Revisa que le hayas dado permiso a tu navegador." });
    }
  }

  function detenerGrabacion() {
    grabadoraRef.current?.stop();
    grabadoraRef.current = null;
    setGrabandoNombre(null);
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
        También puedes grabar un audio de orientación por lugar (ej. explicando por dónde meterse) --
        el bot lo manda cuando piden que los orienten para llegar.
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

              <div className="pt-1 border-t border-gray-100 space-y-1.5">
                <p className="text-[11px] text-gray-500">
                  🎤 Audio de orientación (el bot lo manda cuando pidan que los orienten para llegar)
                </p>
                {u.audio_url && (
                  <audio controls preload="none" className="w-full h-9">
                    <source src={u.audio_url} />
                  </audio>
                )}
                {grabandoNombre === u.nombre ? (
                  <button
                    onClick={detenerGrabacion}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 animate-pulse"
                  >
                    ⏹️ Detener grabación
                  </button>
                ) : (
                  <button
                    onClick={() => grabarAudioDe(u.nombre)}
                    disabled={subiendoAudioDe === u.nombre || grabandoNombre !== null}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {subiendoAudioDe === u.nombre
                      ? "Subiendo audio..."
                      : u.audio_url
                        ? "🎤 Regrabar audio de orientación"
                        : "🎤 Grabar audio de orientación"}
                  </button>
                )}
              </div>
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

"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RecorteVerdeVideo } from "./RecorteVerdeVideo";
import { VideoTransparente } from "@/components/chat/VideoTransparente";

interface MensajeBienvenidaUI {
  id: string;
  orden: number;
  tipo: "texto" | "audio" | "video";
  texto: string | null;
  audio_url: string | null;
  video_url: string | null;
}

export function BienvenidaManager() {
  const [mensajes, setMensajes] = useState<MensajeBienvenidaUI[]>([]);
  const [cargando, setCargando] = useState(true);
  // Ahora esta pantalla vive en su propia pagina (ver
  // /master/asistente-whatsapp/bienvenida), ya no esta mezclada junto
  // con las demas -- por eso empieza abierta de una vez, aunque se
  // deja el boton de colapsar por si Master quiere ocultarla un rato.
  const [abierto, setAbierto] = useState(true);
  const [textoNuevo, setTextoNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [subiendoAudio, setSubiendoAudio] = useState(false);
  const [moviendoId, setMoviendoId] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEditado, setTextoEditado] = useState("");
  const [mostrarVideo, setMostrarVideo] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch("/api/master/bot-demo/bienvenida");
      const data = await res.json().catch(() => null);
      setMensajes(data?.mensajes ?? []);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (abierto) cargar();
  }, [abierto]);

  async function agregarTexto() {
    const texto = textoNuevo.trim();
    if (!texto || guardando) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/master/bot-demo/bienvenida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "texto", texto }),
      });
      if (res.ok) {
        setTextoNuevo("");
        await cargar();
      }
    } finally {
      setGuardando(false);
    }
  }

  async function subirAudio(file: File) {
    setSubiendoAudio(true);
    try {
      const res = await fetch("/api/master/bot-demo/bienvenida/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      const data = (await res.json()) as { path?: string; token?: string; publicUrl?: string; message?: string };
      if (!res.ok || !data.path || !data.token || !data.publicUrl) {
        throw new Error(data.message || "No se pudo iniciar la subida");
      }

      const supabase = createClient();
      const { error: uploadErr } = await supabase.storage
        .from("whatsapp-bot-bienvenida")
        .uploadToSignedUrl(data.path, data.token, file, { contentType: file.type });
      if (uploadErr) throw new Error(uploadErr.message);

      const res2 = await fetch("/api/master/bot-demo/bienvenida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "audio", audio_url: data.publicUrl }),
      });
      if (res2.ok) await cargar();
    } catch {
      alert("No se pudo subir el audio, intenta de nuevo.");
    } finally {
      setSubiendoAudio(false);
      if (inputArchivoRef.current) inputArchivoRef.current.value = "";
    }
  }

  async function mover(id: string, direccion: "arriba" | "abajo") {
    const idx = mensajes.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const nuevoIdx = direccion === "arriba" ? idx - 1 : idx + 1;
    if (nuevoIdx < 0 || nuevoIdx >= mensajes.length) return;

    const copia = [...mensajes];
    [copia[idx], copia[nuevoIdx]] = [copia[nuevoIdx], copia[idx]];
    setMensajes(copia);
    setMoviendoId(id);
    try {
      await fetch("/api/master/bot-demo/bienvenida", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids_en_orden: copia.map((m) => m.id) }),
      });
    } finally {
      setMoviendoId(null);
    }
  }

  function abrirEdicion(m: MensajeBienvenidaUI) {
    setEditandoId(m.id);
    setTextoEditado(m.texto ?? "");
  }

  async function guardarEdicion(id: string) {
    const texto = textoEditado.trim();
    if (!texto) return;
    const res = await fetch("/api/master/bot-demo/bienvenida", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, texto }),
    });
    if (res.ok) {
      setMensajes((prev) => prev.map((m) => (m.id === id ? { ...m, texto } : m)));
      setEditandoId(null);
    }
  }

  async function borrar(id: string) {
    setBorrandoId(id);
    try {
      const res = await fetch("/api/master/bot-demo/bienvenida", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setMensajes((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setBorrandoId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium text-gray-700">👋 Mensajes de bienvenida</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Arma aquí, en el orden que quieras, los audios y textos que se mandan al inicio
          </p>
        </div>
        <span className="text-gray-400">{abierto ? "▲" : "▼"}</span>
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            Esto es lo primero que contesta el bot cuando alguien le escribe por primera vez (al
            darle clic a tu anuncio). Puedes poner los audios y textos que quieras, en el orden que
            quieras, y el bot los va a mandar uno por uno en ese mismo orden.
          </p>

          <div className="space-y-1.5">
            {cargando && <p className="text-xs text-gray-400">Cargando...</p>}
            {!cargando && mensajes.length === 0 && (
              <p className="text-xs text-amber-600">
                ⚠️ No hay ningún mensaje de bienvenida configurado todavía -- agrega al menos uno
                abajo.
              </p>
            )}
            {mensajes.map((m, idx) => (
              <div key={m.id} className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-[11px] font-semibold text-gray-400 shrink-0 mt-0.5">#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  {m.tipo === "audio" ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🎤</span>
                      <audio controls preload="none" className="h-8 flex-1 min-w-0">
                        <source src={m.audio_url ?? ""} />
                      </audio>
                    </div>
                  ) : m.tipo === "video" ? (
                    <div className="max-w-[240px] overflow-hidden rounded-lg">
                      {m.video_url && <VideoTransparente src={m.video_url} />}
                    </div>
                  ) : editandoId === m.id ? (
                    <div className="space-y-1.5">
                      <textarea
                        value={textoEditado}
                        onChange={(e) => setTextoEditado(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditandoId(null)}
                          className="text-[11px] text-gray-500 hover:text-gray-700"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => guardarEdicion(m.id)}
                          className="text-[11px] px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">💬 {m.texto}</p>
                  )}
                </div>
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => mover(m.id, "arriba")}
                    disabled={idx === 0 || moviendoId !== null}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none px-1"
                    title="Subir"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => mover(m.id, "abajo")}
                    disabled={idx === mensajes.length - 1 || moviendoId !== null}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none px-1"
                    title="Bajar"
                  >
                    ▼
                  </button>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  {m.tipo === "texto" && editandoId !== m.id && (
                    <button
                      onClick={() => abrirEdicion(m)}
                      className="text-[11px] text-blue-600 hover:text-blue-800"
                      title="Editar"
                    >
                      ✏️
                    </button>
                  )}
                  <button
                    onClick={() => borrar(m.id)}
                    disabled={borrandoId === m.id}
                    className="text-[11px] text-gray-400 hover:text-red-600 disabled:opacity-50"
                    title="Borrar"
                  >
                    {borrandoId === m.id ? "..." : "🗑️"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <input
              ref={inputArchivoRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) subirAudio(file);
              }}
            />
            <button
              onClick={() => inputArchivoRef.current?.click()}
              disabled={subiendoAudio}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              {subiendoAudio ? "Subiendo audio..." : "🎤 + Agregar audio"}
            </button>
            <button
              onClick={() => setMostrarVideo((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              🎬 + Agregar video (fondo verde)
            </button>
          </div>

          {mostrarVideo && (
            <RecorteVerdeVideo
              onGuardado={() => {
                setMostrarVideo(false);
                cargar();
              }}
            />
          )}

          <div className="space-y-2">
            <textarea
              value={textoNuevo}
              onChange={(e) => setTextoNuevo(e.target.value)}
              rows={2}
              placeholder="Escribe aquí otro mensaje de texto para agregar al final de la lista..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <button
              onClick={agregarTexto}
              disabled={guardando || !textoNuevo.trim()}
              className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "💬 + Agregar texto"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

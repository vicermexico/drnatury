"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
interface Config {
  id: string;
  whatsapp_number: string;
  hero_title: string;
  hero_subtitle: string;
  splash_gif_url: string;
  hero_video_url: string;
  hero_type: string;
  hero_video_loop: boolean;
  hero_video_logo: boolean;
  splash_logo_url: string | null;
  splash_nombre_url: string | null;
  splash_mostrar_logo: boolean;
  splash_mostrar_nombre: boolean;
}
interface Service {
  id: string;
  title: string;
  description: string;
  image_url: string;
  order_index: number;
  is_active: boolean;
}
interface FondoRow {
  id: string;
  tipo: "imagen" | "video";
  url: string;
  orden: number;
  is_active: boolean;
}
interface PersonajeRow {
  id: string;
  nombre: string | null;
  puesto: string | null;
  imagen_url: string;
  orden: number;
  is_active: boolean;
}
interface Props {
  config: Config;
  services: Service[];
  fondos: FondoRow[];
  personajes: PersonajeRow[];
}
export function LandingEditor({ config, services, fondos, personajes }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    whatsapp_number: config?.whatsapp_number ?? "",
    hero_title: config?.hero_title ?? "",
    hero_subtitle: config?.hero_subtitle ?? "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(config?.splash_gif_url ?? null);
  const [imageType, setImageType] = useState(config?.hero_type === "gif" ? "gif" : "image");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(config?.hero_video_url ?? null);
  const [videoLoop, setVideoLoop] = useState(config?.hero_video_loop ?? false);
  const [videoLogo, setVideoLogo] = useState(config?.hero_video_logo ?? false);
  const [statusGeneral, setStatusGeneral] = useState<"idle"|"loading"|"ok"|"error">("idle");
  const [statusImage, setStatusImage] = useState<"idle"|"loading"|"ok"|"error">("idle");
  const [statusVideo, setStatusVideo] = useState<"idle"|"loading"|"ok"|"error">("idle");
  // Pantalla de bienvenida (logo + nombre, antes del boton "Entrar").
  const [splashLogoFile, setSplashLogoFile] = useState<File | null>(null);
  const [splashLogoPreview, setSplashLogoPreview] = useState<string | null>(config?.splash_logo_url ?? null);
  const [mostrarLogo, setMostrarLogo] = useState(config?.splash_mostrar_logo ?? true);
  const [splashNombreFile, setSplashNombreFile] = useState<File | null>(null);
  const [splashNombrePreview, setSplashNombrePreview] = useState<string | null>(config?.splash_nombre_url ?? null);
  const [mostrarNombre, setMostrarNombre] = useState(config?.splash_mostrar_nombre ?? true);
  const [statusSplash, setStatusSplash] = useState<"idle"|"loading"|"ok"|"error">("idle");
  // Fondos rotando de la portada (varias fotos/videos que van cambiando solos).
  const [fondoFile, setFondoFile] = useState<File | null>(null);
  const [fondoPreview, setFondoPreview] = useState<string | null>(null);
  const [fondoTipo, setFondoTipo] = useState<"imagen" | "video">("imagen");
  const [statusFondo, setStatusFondo] = useState<"idle"|"loading"|"ok"|"error">("idle");
  // Personajes (fotos de terapeutas/asistentes que entran deslizandose).
  const [personajeFile, setPersonajeFile] = useState<File | null>(null);
  const [personajePreview, setPersonajePreview] = useState<string | null>(null);
  const [personajeNombre, setPersonajeNombre] = useState("");
  const [personajePuesto, setPersonajePuesto] = useState("");
  const [statusPersonaje, setStatusPersonaje] = useState<"idle"|"loading"|"ok"|"error">("idle");
  async function uploadFile(file: File) {
    // Paso 1: pedirle al servidor un permiso de subida (esto es texto,
    // pesa nada, no tiene problema con limites de tamano).
    const res = await fetch("/api/landing/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name }),
    });
    const data = (await res.json()) as {
      path?: string;
      token?: string;
      publicUrl?: string;
      message?: string;
    };
    if (!res.ok || !data.path || !data.token || !data.publicUrl) {
      throw new Error(data.message || "No se pudo iniciar la subida");
    }

    // Paso 2: subir el archivo DIRECTO a Supabase, sin pasar por Vercel.
    const supabase = createClient();
    const { error: uploadErr } = await supabase.storage
      .from("landing")
      .uploadToSignedUrl(data.path, data.token, file, { contentType: file.type });

    if (uploadErr) {
      throw new Error(uploadErr.message);
    }

    return data.publicUrl;
  }
  async function saveConfig(patch: object) {
    const res = await fetch("/api/landing/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return res.ok;
  }
  async function handleSaveGeneral() {
    setStatusGeneral("loading");
    const ok = await saveConfig(form);
    setStatusGeneral(ok ? "ok" : "error");
    if (ok) router.refresh();
  }
  async function handleSaveImage() {
    setStatusImage("loading");
    try {
      let splash_gif_url = config?.splash_gif_url ?? "";
      if (imageFile) splash_gif_url = await uploadFile(imageFile);
      const ok = await saveConfig({ splash_gif_url, hero_type: imageType });
      setStatusImage(ok ? "ok" : "error");
      if (ok) router.refresh();
    } catch {
      setStatusImage("error");
    }
  }
  async function handleSaveVideo() {
    setStatusVideo("loading");
    try {
      let hero_video_url = config?.hero_video_url ?? "";
      if (videoFile) hero_video_url = await uploadFile(videoFile);
      const ok = await saveConfig({
        hero_video_url,
        hero_type: "video",
        hero_video_loop: videoLoop,
        hero_video_logo: videoLogo,
      });
      setStatusVideo(ok ? "ok" : "error");
      if (ok) router.refresh();
    } catch {
      setStatusVideo("error");
    }
  }
  async function handleSaveSplash() {
    setStatusSplash("loading");
    try {
      let splash_logo_url = config?.splash_logo_url ?? "";
      if (splashLogoFile) splash_logo_url = await uploadFile(splashLogoFile);
      let splash_nombre_url = config?.splash_nombre_url ?? "";
      if (splashNombreFile) splash_nombre_url = await uploadFile(splashNombreFile);
      const ok = await saveConfig({
        splash_logo_url,
        splash_nombre_url,
        splash_mostrar_logo: mostrarLogo,
        splash_mostrar_nombre: mostrarNombre,
      });
      setStatusSplash(ok ? "ok" : "error");
      if (ok) router.refresh();
    } catch {
      setStatusSplash("error");
    }
  }
  async function handleAddFondo() {
    if (!fondoFile) return;
    setStatusFondo("loading");
    try {
      const url = await uploadFile(fondoFile);
      const maxOrden = fondos.reduce((m, f) => Math.max(m, f.orden), 0);
      const res = await fetch("/api/landing/fondos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: fondoTipo, url, orden: maxOrden + 1 }),
      });
      if (!res.ok) throw new Error();
      setFondoFile(null);
      setFondoPreview(null);
      setStatusFondo("ok");
      router.refresh();
    } catch {
      setStatusFondo("error");
    }
  }
  async function handleToggleFondo(f: FondoRow) {
    await fetch(`/api/landing/fondos/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !f.is_active }),
    });
    router.refresh();
  }
  async function handleDeleteFondo(id: string) {
    await fetch(`/api/landing/fondos/${id}`, { method: "DELETE" });
    router.refresh();
  }
  async function handleMoveFondo(index: number, direction: -1 | 1) {
    const ordenados = [...fondos].sort((a, b) => a.orden - b.orden);
    const vecino = ordenados[index + direction];
    const actual = ordenados[index];
    if (!vecino) return;
    await Promise.all([
      fetch(`/api/landing/fondos/${actual.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orden: vecino.orden }),
      }),
      fetch(`/api/landing/fondos/${vecino.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orden: actual.orden }),
      }),
    ]);
    router.refresh();
  }
  async function handleAddPersonaje() {
    if (!personajeFile) return;
    setStatusPersonaje("loading");
    try {
      const imagen_url = await uploadFile(personajeFile);
      const maxOrden = personajes.reduce((m, p) => Math.max(m, p.orden), 0);
      const res = await fetch("/api/landing/personajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: personajeNombre,
          puesto: personajePuesto,
          imagen_url,
          orden: maxOrden + 1,
        }),
      });
      if (!res.ok) throw new Error();
      setPersonajeFile(null);
      setPersonajePreview(null);
      setPersonajeNombre("");
      setPersonajePuesto("");
      setStatusPersonaje("ok");
      router.refresh();
    } catch {
      setStatusPersonaje("error");
    }
  }
  async function handleTogglePersonaje(p: PersonajeRow) {
    await fetch(`/api/landing/personajes/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !p.is_active }),
    });
    router.refresh();
  }
  async function handleDeletePersonaje(id: string) {
    await fetch(`/api/landing/personajes/${id}`, { method: "DELETE" });
    router.refresh();
  }
  async function handleMovePersonaje(index: number, direction: -1 | 1) {
    const ordenados = [...personajes].sort((a, b) => a.orden - b.orden);
    const vecino = ordenados[index + direction];
    const actual = ordenados[index];
    if (!vecino) return;
    await Promise.all([
      fetch(`/api/landing/personajes/${actual.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orden: vecino.orden }),
      }),
      fetch(`/api/landing/personajes/${vecino.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orden: actual.orden }),
      }),
    ]);
    router.refresh();
  }
  const fondosOrdenados = [...fondos].sort((a, b) => a.orden - b.orden);
  const personajesOrdenados = [...personajes].sort((a, b) => a.orden - b.orden);
  return (
    <div className="space-y-6">
      {/* Pantalla de bienvenida (logo + nombre) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Pantalla de bienvenida</h2>
          <p className="text-xs text-gray-400 mt-1">Las 2 imágenes que salen antes del botón &quot;Entrar&quot;: primero el logo, luego el nombre.</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">1. Logo (emblema)</label>
            <button type="button" onClick={() => setMostrarLogo((v) => !v)} className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${mostrarLogo ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-500 border-gray-200"}`}>
              {mostrarLogo ? "Se muestra" : "Oculto"}
            </button>
          </div>
          {mostrarLogo && (
            <>
              {splashLogoPreview && <img src={splashLogoPreview} alt="Vista previa del logo" className="w-full h-32 object-contain bg-gray-50 rounded-xl" />}
              <label className="flex items-center justify-center gap-2 cursor-pointer w-full rounded-xl border-2 border-dashed border-gray-300 px-4 py-3 hover:border-blue-400 hover:bg-blue-50 transition">
                <span className="text-sm font-medium text-gray-600">{splashLogoFile ? splashLogoFile.name : "Cambiar imagen del logo"}</span>
                <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setSplashLogoFile(f); setSplashLogoPreview(URL.createObjectURL(f)); } }} className="hidden" />
              </label>
            </>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">2. Nombre (letras &quot;DrNatury&quot;)</label>
            <button type="button" onClick={() => setMostrarNombre((v) => !v)} className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${mostrarNombre ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-500 border-gray-200"}`}>
              {mostrarNombre ? "Se muestra" : "Oculto"}
            </button>
          </div>
          {mostrarNombre && (
            <>
              {splashNombrePreview && <img src={splashNombrePreview} alt="Vista previa del nombre" className="w-full h-32 object-contain bg-gray-50 rounded-xl" />}
              <label className="flex items-center justify-center gap-2 cursor-pointer w-full rounded-xl border-2 border-dashed border-gray-300 px-4 py-3 hover:border-blue-400 hover:bg-blue-50 transition">
                <span className="text-sm font-medium text-gray-600">{splashNombreFile ? splashNombreFile.name : "Cambiar imagen del nombre"}</span>
                <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setSplashNombreFile(f); setSplashNombrePreview(URL.createObjectURL(f)); } }} className="hidden" />
              </label>
            </>
          )}
        </div>
        {!mostrarLogo && !mostrarNombre && (
          <p className="text-xs text-amber-600">⚠️ Si ocultas las 2, el botón &quot;Entrar&quot; va a salir solo, sin ninguna imagen antes.</p>
        )}
        {statusSplash === "ok" && <p className="text-sm text-green-600 font-medium">Guardado correctamente</p>}
        {statusSplash === "error" && <p className="text-sm text-red-600">Error al guardar</p>}
        <button onClick={handleSaveSplash} disabled={statusSplash === "loading"} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {statusSplash === "loading" ? "Guardando..." : "Guardar pantalla de bienvenida"}
        </button>
      </div>
      {/* Configuracion general */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Configuracion general</h2>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Numero de WhatsApp</label>
          <input type="text" value={form.whatsapp_number} onChange={e => setForm(f => ({ ...f, whatsapp_number: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-400" placeholder="528112345678" />
          <p className="text-xs text-gray-400 mt-1">Sin espacios ni guiones. Ej: 528112345678</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Titulo principal</label>
          <input type="text" value={form.hero_title} onChange={e => setForm(f => ({ ...f, hero_title: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-400" placeholder="Bienvenido a Dr. BioEscaner" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subtitulo</label>
          <input type="text" value={form.hero_subtitle} onChange={e => setForm(f => ({ ...f, hero_subtitle: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-400" placeholder="Agenda tu cita hoy" />
        </div>
        {statusGeneral === "ok" && <p className="text-sm text-green-600 font-medium">Guardado correctamente</p>}
        {statusGeneral === "error" && <p className="text-sm text-red-600">Error al guardar</p>}
        <button onClick={handleSaveGeneral} disabled={statusGeneral === "loading"} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {statusGeneral === "loading" ? "Guardando..." : "Guardar configuracion"}
        </button>
      </div>
      {/* Imagen fija */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Imagen fija de fondo</h2>
        <p className="text-xs text-gray-400">Se muestra cuando termina el video (si elegiste "una sola vez") o si no hay video</p>
        <div className="flex gap-2">
          {["image", "gif"].map(t => (
            <button key={t} onClick={() => setImageType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${imageType === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
              {t === "image" ? "Imagen" : "GIF"}
            </button>
          ))}
        </div>
        {imagePreview && <img src={imagePreview} className="w-full h-40 object-cover rounded-xl" />}
        <label className="flex items-center justify-center gap-2 cursor-pointer w-full rounded-xl border-2 border-dashed border-gray-300 px-4 py-4 hover:border-blue-400 hover:bg-blue-50 transition">
          <span className="text-sm font-medium text-gray-600">{imageFile ? imageFile.name : "Cambiar imagen"}</span>
          <input type="file" accept={imageType === "gif" ? "image/gif" : "image/*"} onChange={e => { const f = e.target.files?.[0]; if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); } }} className="hidden" />
        </label>
        {statusImage === "ok" && <p className="text-sm text-green-600 font-medium">Guardado correctamente</p>}
        {statusImage === "error" && <p className="text-sm text-red-600">Error al guardar</p>}
        <button onClick={handleSaveImage} disabled={statusImage === "loading"} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {statusImage === "loading" ? "Guardando..." : "Guardar imagen"}
        </button>
      </div>
      {/* Video */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Video de fondo</h2>
        <p className="text-xs text-gray-400">Se reproduce al entrar a la pagina. Solo MP4, maximo 15 segundos</p>
        {videoPreview && <video src={videoPreview} className="w-full h-40 object-cover rounded-xl" controls />}
        <label className="flex items-center justify-center gap-2 cursor-pointer w-full rounded-xl border-2 border-dashed border-gray-300 px-4 py-4 hover:border-blue-400 hover:bg-blue-50 transition">
          <span className="text-sm font-medium text-gray-600">{videoFile ? videoFile.name : "Cambiar video MP4"}</span>
          <input type="file" accept="video/mp4" onChange={e => { const f = e.target.files?.[0]; if (f) { setVideoFile(f); setVideoPreview(URL.createObjectURL(f)); } }} className="hidden" />
        </label>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">¿Como se reproduce?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setVideoLoop(false)}
              className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold border transition ${!videoLoop ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}
            >
              Solo una vez (se corta a la imagen)
            </button>
            <button
              type="button"
              onClick={() => setVideoLoop(true)}
              className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold border transition ${videoLoop ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}
            >
              Continuo (en bucle)
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Logo encima del video</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setVideoLogo(false)}
              className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold border transition ${!videoLogo ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}
            >
              Sin logo
            </button>
            <button
              type="button"
              onClick={() => setVideoLogo(true)}
              className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold border transition ${videoLogo ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}
            >
              Con logo de DrNatury
            </button>
          </div>
        </div>

        {statusVideo === "ok" && <p className="text-sm text-green-600 font-medium">Guardado correctamente</p>}
        {statusVideo === "error" && <p className="text-sm text-red-600">Error al guardar</p>}
        <button onClick={handleSaveVideo} disabled={statusVideo === "loading"} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {statusVideo === "loading" ? "Guardando..." : "Guardar video"}
        </button>
      </div>
      {/* Fondos rotando de la portada */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Fondos de la portada</h2>
          <p className="text-xs text-gray-400 mt-1">
            Si subes varias fotos o videos, van a ir cambiando solos en la pantalla de inicio. Si no subes ninguno, se usa la imagen/video fijo de arriba.
          </p>
        </div>
        <div className="space-y-2">
          {fondosOrdenados.length === 0 && <p className="text-sm text-gray-400">No hay fondos agregados.</p>}
          {fondosOrdenados.map((f, i) => (
            <div key={f.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {f.tipo === "imagen" ? (
                  <img src={f.url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                ) : (
                  <video src={f.url} className="w-12 h-12 rounded-lg object-cover shrink-0" muted />
                )}
                <p className="text-xs text-gray-500 truncate">{f.tipo === "imagen" ? "Imagen" : "Video"}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button type="button" onClick={() => handleMoveFondo(i, -1)} disabled={i === 0} className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => handleMoveFondo(i, 1)} disabled={i === fondosOrdenados.length - 1} className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => handleToggleFondo(f)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${f.is_active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-500 border-gray-200"}`}>
                  {f.is_active ? "Activo" : "Oculto"}
                </button>
                <button type="button" onClick={() => handleDeleteFondo(f.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {(["imagen", "video"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setFondoTipo(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${fondoTipo === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
              {t === "imagen" ? "Imagen" : "Video"}
            </button>
          ))}
        </div>
        {fondoPreview && (fondoTipo === "imagen" ? <img src={fondoPreview} alt="Vista previa del fondo" className="w-full h-32 object-cover rounded-xl" /> : <video src={fondoPreview} className="w-full h-32 object-cover rounded-xl" controls />)}
        <label className="flex items-center justify-center gap-2 cursor-pointer w-full rounded-xl border-2 border-dashed border-gray-300 px-4 py-4 hover:border-blue-400 hover:bg-blue-50 transition">
          <span className="text-sm font-medium text-gray-600">{fondoFile ? fondoFile.name : "Subir nuevo fondo"}</span>
          <input type="file" accept={fondoTipo === "imagen" ? "image/*" : "video/mp4"} onChange={e => { const f = e.target.files?.[0]; if (f) { setFondoFile(f); setFondoPreview(URL.createObjectURL(f)); } }} className="hidden" />
        </label>
        {statusFondo === "ok" && <p className="text-sm text-green-600 font-medium">Agregado correctamente</p>}
        {statusFondo === "error" && <p className="text-sm text-red-600">Error al agregar</p>}
        <button onClick={handleAddFondo} disabled={!fondoFile || statusFondo === "loading"} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {statusFondo === "loading" ? "Subiendo..." : "Agregar fondo"}
        </button>
      </div>
      {/* Personajes (fotos de terapeutas/asistentes) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Personajes de la portada</h2>
          <p className="text-xs text-gray-400 mt-1">
            Fotos de terapeutas o asistentes que van a ir apareciendo en la pantalla de inicio, con su nombre y puesto.
          </p>
        </div>
        <div className="space-y-2">
          {personajesOrdenados.length === 0 && <p className="text-sm text-gray-400">No hay personajes agregados.</p>}
          {personajesOrdenados.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img src={p.imagen_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.nombre || "(sin nombre)"}</p>
                  <p className="text-xs text-gray-400 truncate">{p.puesto}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button type="button" onClick={() => handleMovePersonaje(i, -1)} disabled={i === 0} className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => handleMovePersonaje(i, 1)} disabled={i === personajesOrdenados.length - 1} className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => handleTogglePersonaje(p)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${p.is_active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-500 border-gray-200"}`}>
                  {p.is_active ? "Activo" : "Oculto"}
                </button>
                <button type="button" onClick={() => handleDeletePersonaje(p.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</label>
          <input type="text" value={personajeNombre} onChange={e => setPersonajeNombre(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-400" placeholder="Dr. Alejandro" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Puesto</label>
          <input type="text" value={personajePuesto} onChange={e => setPersonajePuesto(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-400" placeholder="Terapeuta" />
        </div>
        {personajePreview && <img src={personajePreview} alt="Vista previa de la foto" className="w-full h-32 object-contain bg-gray-50 rounded-xl" />}
        <label className="flex items-center justify-center gap-2 cursor-pointer w-full rounded-xl border-2 border-dashed border-gray-300 px-4 py-4 hover:border-blue-400 hover:bg-blue-50 transition">
          <span className="text-sm font-medium text-gray-600">{personajeFile ? personajeFile.name : "Subir foto"}</span>
          <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setPersonajeFile(f); setPersonajePreview(URL.createObjectURL(f)); } }} className="hidden" />
        </label>
        {statusPersonaje === "ok" && <p className="text-sm text-green-600 font-medium">Agregado correctamente</p>}
        {statusPersonaje === "error" && <p className="text-sm text-red-600">Error al agregar</p>}
        <button onClick={handleAddPersonaje} disabled={!personajeFile || statusPersonaje === "loading"} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {statusPersonaje === "loading" ? "Subiendo..." : "Agregar personaje"}
        </button>
      </div>
      {/* Servicios */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Servicios</h2>
          <a href="/master/landing/servicio/nuevo" className="text-xs font-semibold text-blue-600 hover:text-blue-700">+ Agregar servicio</a>
        </div>
        {services.length === 0 && <p className="text-sm text-gray-400">No hay servicios aun. Agrega el primero.</p>}
        <div className="space-y-2">
          {services.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              <div className="flex items-center gap-3">
                {s.image_url && <img src={s.image_url} className="w-10 h-10 rounded-lg object-cover" />}
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.title}</p>
                  <p className="text-xs text-gray-400 truncate max-w-xs">{s.description}</p>
                </div>
              </div>
              <a href={`/master/landing/servicio/${s.id}`} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Editar</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

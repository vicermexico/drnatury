"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Config {
  id: string;
  whatsapp_number: string;
  hero_title: string;
  hero_subtitle: string;
  splash_gif_url: string;
  hero_video_url: string;
  hero_type: string;
}

interface Service {
  id: string;
  title: string;
  description: string;
  image_url: string;
  order_index: number;
  is_active: boolean;
}

interface Props {
  config: Config;
  services: Service[];
}

export function LandingEditor({ config, services }: Props) {
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

  const [statusGeneral, setStatusGeneral] = useState<"idle"|"loading"|"ok"|"error">("idle");
  const [statusImage, setStatusImage] = useState<"idle"|"loading"|"ok"|"error">("idle");
  const [statusVideo, setStatusVideo] = useState<"idle"|"loading"|"ok"|"error">("idle");

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/landing/upload", { method: "POST", body: formData });
    const data = await res.json() as { url: string };
    return data.url;
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
    let splash_gif_url = config?.splash_gif_url ?? "";
    if (imageFile) splash_gif_url = await uploadFile(imageFile);
    const ok = await saveConfig({ splash_gif_url, hero_type: imageType });
    setStatusImage(ok ? "ok" : "error");
    if (ok) router.refresh();
  }

  async function handleSaveVideo() {
    setStatusVideo("loading");
    let hero_video_url = config?.hero_video_url ?? "";
    if (videoFile) hero_video_url = await uploadFile(videoFile);
    const ok = await saveConfig({ hero_video_url, hero_type: "video" });
    setStatusVideo(ok ? "ok" : "error");
    if (ok) router.refresh();
  }

  return (
    <div className="space-y-6">

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
        <p className="text-xs text-gray-400">Se muestra cuando termina el video o si no hay video</p>
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
        {statusVideo === "ok" && <p className="text-sm text-green-600 font-medium">Guardado correctamente</p>}
        {statusVideo === "error" && <p className="text-sm text-red-600">Error al guardar</p>}
        <button onClick={handleSaveVideo} disabled={statusVideo === "loading"} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {statusVideo === "loading" ? "Guardando..." : "Guardar video"}
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Servicio {
  id: string;
  title: string;
  description: string;
  image_url: string;
  detail_media_url: string;
  detail_media_type: string;
}

export function ServicioEditForm({ servicio }: { servicio: Servicio }) {
  const router = useRouter();
  const [title, setTitle] = useState(servicio.title);
  const [description, setDescription] = useState(servicio.description ?? "");
  const [image, setImage] = useState<File | null>(null);
  const [detailMedia, setDetailMedia] = useState<File | null>(null);
  const [detailType, setDetailType] = useState<"image" | "video">((servicio.detail_media_type as "image" | "video") ?? "image");
  const [preview, setPreview] = useState<string | null>(servicio.image_url ?? null);
  const [detailPreview, setDetailPreview] = useState<string | null>(servicio.detail_media_url ?? null);
  const [statusInfo, setStatusInfo] = useState<"idle"|"loading"|"ok"|"error">("idle");
  const [statusImage, setStatusImage] = useState<"idle"|"loading"|"ok"|"error">("idle");
  const [statusDetail, setStatusDetail] = useState<"idle"|"loading"|"ok"|"error">("idle");
  const [error, setError] = useState("");

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/landing/upload", { method: "POST", body: formData });
    const data = await res.json() as { url: string };
    return data.url;
  }

  async function patchServicio(patch: object) {
    const res = await fetch(`/api/landing/servicios/${servicio.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return res.ok;
  }

  async function handleSaveInfo() {
    if (!title) { setError("El titulo es obligatorio"); return; }
    setError("");
    setStatusInfo("loading");
    const ok = await patchServicio({ title, description });
    setStatusInfo(ok ? "ok" : "error");
    if (ok) router.refresh();
  }

  async function handleSaveImage() {
    setStatusImage("loading");
    let image_url = servicio.image_url;
    if (image) image_url = await uploadFile(image);
    const ok = await patchServicio({ image_url });
    setStatusImage(ok ? "ok" : "error");
    if (ok) router.refresh();
  }

  async function handleSaveDetail() {
    setStatusDetail("loading");
    let detail_media_url = servicio.detail_media_url;
    if (detailMedia) detail_media_url = await uploadFile(detailMedia);
    const ok = await patchServicio({ detail_media_url, detail_media_type: detailType });
    setStatusDetail(ok ? "ok" : "error");
    if (ok) router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm("Seguro que quieres eliminar este servicio?")) return;
    const res = await fetch(`/api/landing/servicios/${servicio.id}`, { method: "DELETE" });
    if (res.ok) { router.push("/master/landing"); router.refresh(); }
  }

  return (
    <div className="space-y-6">

      {/* Info */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Informacion del servicio</h2>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Titulo</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Descripcion</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {statusInfo === "ok" && <p className="text-sm text-green-600 font-medium">Guardado correctamente</p>}
        {statusInfo === "error" && <p className="text-sm text-red-600">Error al guardar</p>}
        <button onClick={handleSaveInfo} disabled={statusInfo === "loading"} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {statusInfo === "loading" ? "Guardando..." : "Guardar informacion"}
        </button>
      </div>

      {/* Imagen principal */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Imagen principal</h2>
        <p className="text-xs text-gray-400">Foto que se ve en la pagina de inicio</p>
        {preview && <img src={preview} className="w-full h-40 object-cover rounded-xl" />}
        <label className="flex items-center justify-center gap-2 cursor-pointer w-full rounded-xl border-2 border-dashed border-gray-300 px-4 py-4 hover:border-blue-400 hover:bg-blue-50 transition">
          <span className="text-sm font-medium text-gray-600">{image ? image.name : "Cambiar imagen"}</span>
          <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setImage(f); setPreview(URL.createObjectURL(f)); } }} className="hidden" />
        </label>
        {statusImage === "ok" && <p className="text-sm text-green-600 font-medium">Guardado correctamente</p>}
        {statusImage === "error" && <p className="text-sm text-red-600">Error al guardar</p>}
        <button onClick={handleSaveImage} disabled={statusImage === "loading"} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {statusImage === "loading" ? "Guardando..." : "Guardar imagen"}
        </button>
      </div>

      {/* Media detalle */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Foto o video del servicio</h2>
        <p className="text-xs text-gray-400">Se muestra cuando el paciente abre el servicio</p>
        <div className="flex gap-2">
          <button onClick={() => setDetailType("image")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${detailType === "image" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>Imagen</button>
          <button onClick={() => setDetailType("video")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${detailType === "video" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>Video</button>
        </div>
        {detailPreview && (
          detailType === "image"
            ? <img src={detailPreview} className="w-full h-40 object-cover rounded-xl" />
            : <video src={detailPreview} className="w-full h-40 object-cover rounded-xl" controls />
        )}
        <label className="flex items-center justify-center gap-2 cursor-pointer w-full rounded-xl border-2 border-dashed border-gray-300 px-4 py-4 hover:border-blue-400 hover:bg-blue-50 transition">
          <span className="text-sm font-medium text-gray-600">{detailMedia ? detailMedia.name : detailType === "video" ? "Cambiar video MP4" : "Cambiar imagen"}</span>
          <input type="file" accept={detailType === "video" ? "video/mp4" : "image/*"} onChange={e => { const f = e.target.files?.[0]; if (f) { setDetailMedia(f); setDetailPreview(URL.createObjectURL(f)); } }} className="hidden" />
        </label>
        {statusDetail === "ok" && <p className="text-sm text-green-600 font-medium">Guardado correctamente</p>}
        {statusDetail === "error" && <p className="text-sm text-red-600">Error al guardar</p>}
        <button onClick={handleSaveDetail} disabled={statusDetail === "loading"} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {statusDetail === "loading" ? "Guardando..." : "Guardar foto o video"}
        </button>
      </div>

      {/* Eliminar */}
      <button onClick={handleDelete} className="w-full rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 transition">
        Eliminar servicio
      </button>

    </div>
  );
}

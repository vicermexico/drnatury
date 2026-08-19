"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ServicioForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [detailMedia, setDetailMedia] = useState<File | null>(null);
  const [detailType, setDetailType] = useState<"image" | "video">("image");
  const [preview, setPreview] = useState<string | null>(null);
  const [detailPreview, setDetailPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/landing/upload", { method: "POST", body: formData });
    const data = await res.json() as { url: string };
    return data.url;
  }

  async function handleSubmit() {
    if (!title) { setError("El tÃ­tulo es obligatorio"); return; }
    setStatus("loading");
    setError("");

    let image_url = "";
    let detail_media_url = "";

    if (image) image_url = await uploadFile(image);
    if (detailMedia) detail_media_url = await uploadFile(detailMedia);

    const res = await fetch("/api/landing/servicios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, image_url, detail_media_url, detail_media_type: detailType }),
    });

    if (res.ok) {
      router.push("/master/landing");
      router.refresh();
    } else {
      setError("Error al guardar. Intenta de nuevo.");
      setStatus("error");
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">TÃ­tulo del servicio</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-400" placeholder="Ej: Biomagnetismo" />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">DescripciÃ³n</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-400" placeholder="Describe el servicio..." />
      </div>

      {/* Foto tarjeta */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Imagen principal</label>
        <p className="text-xs text-gray-400 mt-0.5 mb-2">Foto que se ve en la pÃ¡gina de inicio</p>
        {preview && <img src={preview} className="w-full h-40 object-cover rounded-xl mb-2" />}
        <label className="flex items-center justify-center gap-2 cursor-pointer w-full rounded-xl border-2 border-dashed border-gray-300 px-4 py-4 hover:border-blue-400 hover:bg-blue-50 transition">
          <span className="text-2xl">ðŸ“</span>
          <span className="text-sm font-medium text-gray-600">{image ? image.name : "Seleccionar imagen"}</span>
          <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setImage(f); setPreview(URL.createObjectURL(f)); } }} className="hidden" />
        </label>
      </div>

      {/* Media detalle */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Foto o video de la descripciÃ³n del servicio</label>
        <p className="text-xs text-gray-400 mt-0.5 mb-2">Se muestra cuando el paciente abre el servicio</p>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setDetailType("image")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${detailType === "image" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>ðŸ–¼ï¸ Imagen</button>
          <button onClick={() => setDetailType("video")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${detailType === "video" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>ðŸŽ¥ Video</button>
        </div>
        {detailPreview && (
          detailType === "image"
            ? <img src={detailPreview} className="w-full h-40 object-cover rounded-xl mb-2" />
            : <video src={detailPreview} className="w-full h-40 object-cover rounded-xl mb-2" controls />
        )}
        <label className="flex items-center justify-center gap-2 cursor-pointer w-full rounded-xl border-2 border-dashed border-gray-300 px-4 py-4 hover:border-blue-400 hover:bg-blue-50 transition">
          <span className="text-2xl">{detailType === "video" ? "ðŸŽ¥" : "ðŸ“"}</span>
          <span className="text-sm font-medium text-gray-600">{detailMedia ? detailMedia.name : detailType === "video" ? "Seleccionar video MP4" : "Seleccionar imagen"}</span>
          <input type="file" accept={detailType === "video" ? "video/mp4" : "image/*"} onChange={e => { const f = e.target.files?.[0]; if (f) { setDetailMedia(f); setDetailPreview(URL.createObjectURL(f)); } }} className="hidden" />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button onClick={handleSubmit} disabled={status === "loading"} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
        {status === "loading" ? "Guardando..." : "Guardar servicio"}
      </button>
    </div>
  );
}



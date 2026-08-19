"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

export function NuevoProductoForm({
  redirectTo = "/almacen/inventario",
  appendProductId = true,
}: {
  redirectTo?: string;
  appendProductId?: boolean;
} = {}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [minQty, setMinQty] = useState("0");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no puede pesar más de 5 MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadImage(file: File): Promise<string> {
    const supabase = createClient();
    const ext    = file.name.split(".").pop() ?? "jpg";
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const path   = `${unique}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("product-images")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (upErr) throw new Error(upErr.message);

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      let imageUrl: string | undefined;

      if (imageFile) {
        setUploading(true);
        try {
          imageUrl = await uploadImage(imageFile);
        } catch (err) {
          setError(`Error al subir la imagen: ${err instanceof Error ? err.message : "intenta de nuevo"}`);
          setUploading(false);
          return;
        }
        setUploading(false);
      }

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          min_weekly_quantity: parseInt(minQty, 10) || 0,
          image_url: imageUrl,
        }),
      });
      const data = await res.json() as { id?: string; message?: string };
      if (!res.ok) { setError(data.message ?? "Error al crear el producto"); return; }
      router.push(appendProductId ? `${redirectTo}/${data.id}` : redirectTo);
    });
  }

  const busy = isPending || uploading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Foto del producto */}
      <div>
        <label className={lc}>Foto del producto</label>
        {imagePreview ? (
          <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-gray-200 group">
            <Image
              src={imagePreview}
              alt="Vista previa"
              fill
              className="object-cover"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-medium"
            >
              Quitar
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
            <span className="text-2xl">📷</span>
            <span className="text-xs text-gray-500 mt-1">Seleccionar imagen</span>
            <span className="text-[11px] text-gray-400">JPG, PNG, WEBP — máx. 5 MB</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
        )}
      </div>

      <div>
        <label className={lc}>Nombre del producto *</label>
        <input
          required value={name} onChange={e => setName(e.target.value)}
          placeholder="Ej. Crema hidratante"
          className={ic}
        />
      </div>

      <div>
        <label className={lc}>Descripción</label>
        <textarea
          value={description} onChange={e => setDescription(e.target.value)}
          rows={2} placeholder="Opcional"
          className={ic + " resize-none"}
        />
      </div>

      <div>
        <label className={lc}>Stock mínimo semanal</label>
        <p className="text-xs text-gray-400 mb-1">
          Se mostrará alerta cuando el stock esté igual o por debajo de este número
        </p>
        <input
          type="number" min={0} value={minQty}
          onChange={e => setMinQty(e.target.value)}
          className={ic}
        />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()} disabled={busy}
          className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
          Cancelar
        </button>
        <button type="submit" disabled={busy}
          className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {uploading ? "Subiendo foto…" : isPending ? "Creando…" : "Crear producto"}
        </button>
      </div>
    </form>
  );
}

const lc = "block text-sm font-medium text-gray-700 mb-1";
const ic = "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

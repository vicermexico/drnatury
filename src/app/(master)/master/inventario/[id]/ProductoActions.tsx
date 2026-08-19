"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

interface Producto {
  id: string;
  name: string;
  description: string | null;
  min_weekly_quantity: number;
  is_active: boolean;
  image_url: string | null;
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

function EditForm({ producto, onCancel }: { producto: Producto; onCancel: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error,    setError]    = useState("");
  const [name,     setName]     = useState(producto.name);
  const [desc,     setDesc]     = useState(producto.description ?? "");
  const [minQty,   setMinQty]   = useState(String(producto.min_weekly_quantity));
  const [isActive, setIsActive] = useState(producto.is_active);
  const [imageFile,    setImageFile]    = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(producto.image_url);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("La imagen no puede pesar más de 5 MB"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      let imageUrl: string | null = imagePreview; // keep existing if no new file

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

      const res = await fetch(`/api/products/${producto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim() || null,
          min_weekly_quantity: parseInt(minQty, 10) || 0,
          is_active: isActive,
          image_url: imageUrl,
        }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) { setError(data.message ?? "Error al guardar"); return; }
      router.refresh();
      onCancel();
    });
  }

  const busy = isPending || uploading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {/* Foto */}
      <div>
        <label className={lc}>Foto del producto</label>
        {imagePreview ? (
          <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-gray-200 group">
            <Image src={imagePreview} alt="Vista previa" fill className="object-cover" />
            <button type="button" onClick={removeImage}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-medium">
              Quitar
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-24 rounded-xl border-2 border-dashed border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
            <span className="text-xl">📷</span>
            <span className="text-xs text-gray-500 mt-1">Seleccionar imagen</span>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange} className="sr-only" />
          </label>
        )}
      </div>

      <div>
        <label className={lc}>Nombre *</label>
        <input required value={name} onChange={e => setName(e.target.value)} className={ic} />
      </div>
      <div>
        <label className={lc}>Descripción</label>
        <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} className={ic + " resize-none"} />
      </div>
      <div>
        <label className={lc}>Stock mínimo semanal</label>
        <input type="number" min={0} value={minQty} onChange={e => setMinQty(e.target.value)} className={ic} />
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" id="is_active" checked={isActive} onChange={e => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600" />
        <label htmlFor="is_active" className="text-sm text-gray-700 cursor-pointer">Producto activo</label>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} disabled={busy}
          className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
          Cancelar
        </button>
        <button type="submit" disabled={busy}
          className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {uploading ? "Subiendo foto…" : isPending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

function DeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await fetch(`/api/products/${id}`, { method: "DELETE" });
      router.push("/master/inventario");
    });
  }

  if (confirming) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-3">
        <p className="text-sm font-medium text-red-800">¿Eliminar <span className="font-bold">{name}</span>?</p>
        <div className="flex gap-2">
          <button onClick={() => setConfirming(false)}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-white transition">
            Cancelar
          </button>
          <button onClick={handleDelete} disabled={isPending}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-60">
            {isPending ? "Eliminando…" : "Sí, eliminar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition">
      Eliminar producto
    </button>
  );
}

export function ProductoActions({ producto }: { producto: Producto }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="space-y-3">
      {editing ? (
        <div className="rounded-2xl bg-white border border-blue-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Editar producto</h2>
          <EditForm producto={producto} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition">
          Editar producto
        </button>
      )}
      <DeleteButton id={producto.id} name={producto.name} />
    </div>
  );
}

const lc = "block text-sm font-medium text-gray-700 mb-1";
const ic = "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

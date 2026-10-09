"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

interface ReferenceItem {
  id: string;
  label: string;
  meaning: string;
  zone: string | null;
  image_path: string;
  image_url: string | null;
  created_at: string;
}

export function IrisBancoPanel({ initialReferences }: { initialReferences: ReferenceItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [meaning, setMeaning] = useState("");
  const [zone, setZone] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no puede pesar mas de 5 MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  }

  function resetForm() {
    setLabel("");
    setMeaning("");
    setZone("");
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !meaning.trim() || !imageFile) {
      setError("Completa la imagen, el nombre y el significado");
      return;
    }
    setError("");

    startTransition(async () => {
      try {
        const supabase = createClient();
        const ext = imageFile.name.split(".").pop() ?? "jpg";
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("iris-reference")
          .upload(path, imageFile, { contentType: imageFile.type, upsert: false });
        if (upErr) throw new Error(upErr.message);

        const res = await fetch("/api/iris/reference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label, meaning, zone, image_path: path }),
        });
        if (!res.ok) throw new Error("Error al guardar");

        resetForm();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al subir");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta imagen de referencia?")) return;
    startTransition(async () => {
      await fetch(`/api/iris/reference?id=${id}`, { method: "DELETE" });
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Agregar imagen de referencia</p>

        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange}
          className="block w-full text-sm text-gray-600" />
        {imagePreview && (
          <Image src={imagePreview} alt="preview" width={120} height={120}
            className="rounded-xl object-cover h-28 w-28 border border-gray-200" unoptimized />
        )}

        <input type="text" value={label} onChange={e => setLabel(e.target.value)}
          placeholder="Nombre (ej. Anillo de estres)"
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm bg-white focus:outline-none" />

        <input type="text" value={zone} onChange={e => setZone(e.target.value)}
          placeholder="Zona (opcional, ej. estomago)"
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm bg-white focus:outline-none" />

        <textarea value={meaning} onChange={e => setMeaning(e.target.value)}
          placeholder="Que indica (ej. posible inflamacion gastrica / gastritis)"
          rows={2}
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm bg-white focus:outline-none" />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={isPending}
          className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition disabled:opacity-60">
          {isPending ? "Guardando..." : "Agregar al banco"}
        </button>
      </form>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Banco actual ({initialReferences.length})
        </p>
        {initialReferences.length === 0 ? (
          <p className="text-sm text-gray-400">Todavia no agregas ninguna imagen de referencia.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {initialReferences.map((r) => (
              <div key={r.id} className="rounded-2xl bg-white border border-gray-200 p-3 space-y-2">
                {r.image_url && (
                  <Image src={r.image_url} alt={r.label} width={160} height={160}
                    className="rounded-xl object-cover h-32 w-full border border-gray-100" unoptimized />
                )}
                <p className="text-sm font-semibold text-gray-900">{r.label}</p>
                {r.zone && <p className="text-xs text-gray-400">Zona: {r.zone}</p>}
                <p className="text-xs text-gray-600">{r.meaning}</p>
                <button onClick={() => handleDelete(r.id)} disabled={isPending}
                  className="text-xs text-red-500 hover:text-red-700">
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

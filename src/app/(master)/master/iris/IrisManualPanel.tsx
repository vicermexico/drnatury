"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IrisManualEntry } from "@/types";

export function IrisManualPanel({ initialEntries }: { initialEntries: IrisManualEntry[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  function resetForm() {
    setTopic("");
    setContent("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || !content.trim()) {
      setError("Completa el tema y el contenido");
      return;
    }
    setError("");

    startTransition(async () => {
      try {
        const res = await fetch("/api/iris/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, content }),
        });
        if (!res.ok) throw new Error("Error al guardar");

        resetForm();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta entrada del manual?")) return;
    startTransition(async () => {
      await fetch(`/api/iris/manual?id=${id}`, { method: "DELETE" });
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-gray-700">Manual de consulta</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Descripciones generales por tema (ej. estomago, huesos) que la IA
          usa junto con el banco de imagenes al comparar una foto. Escribe
          siempre con tus propias palabras — no copies texto literal de
          libros con derechos de autor.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Agregar entrada</p>

        <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
          placeholder="Tema (ej. Estomago)"
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm bg-white focus:outline-none" />

        <textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder="Descripcion del tema, con tus propias palabras..."
          rows={5}
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm bg-white focus:outline-none" />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={isPending}
          className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition disabled:opacity-60">
          {isPending ? "Guardando..." : "Agregar al manual"}
        </button>
      </form>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Entradas actuales ({initialEntries.length})
        </p>
        {initialEntries.length === 0 ? (
          <p className="text-sm text-gray-400">Todavia no agregas ninguna entrada al manual.</p>
        ) : (
          <div className="space-y-2">
            {initialEntries.map((entry) => (
              <div key={entry.id} className="rounded-2xl bg-white border border-gray-200 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{entry.topic}</p>
                  <button
                    onClick={() => setOpen(open === entry.id ? null : entry.id)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    {open === entry.id ? "Ocultar" : "Ver"}
                  </button>
                </div>
                {open === entry.id && (
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{entry.content}</p>
                )}
                <button onClick={() => handleDelete(entry.id)} disabled={isPending}
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

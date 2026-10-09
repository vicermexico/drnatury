"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { IrisEye, IrisFindingMatch } from "@/types";

interface Photo {
  id: string;
  eye: IrisEye;
  image_url: string | null;
  created_at: string;
}
interface Finding {
  id: string;
  patient_photo_id: string;
  summary: string;
  matches: IrisFindingMatch[];
  disclaimer: string;
  created_at: string;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Monterrey",
  });
}

export function IrisPanel({ patientId }: { patientId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparingId, setComparingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadAll() {
    setLoading(true);
    try {
      const [photosRes, findingsRes] = await Promise.all([
        fetch(`/api/iris/photos?patient_id=${patientId}`).then((r) => r.json()),
        fetch(`/api/iris/findings?patient_id=${patientId}`).then((r) => r.json()),
      ]);
      setPhotos(Array.isArray(photosRes) ? photosRes : []);
      setFindings(Array.isArray(findingsRes) ? findingsRes : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  async function handleComparar(photoId: string) {
    setComparingId(photoId);
    setError("");
    try {
      const res = await fetch("/api/iris/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_photo_id: photoId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Error al comparar");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al comparar");
    } finally {
      setComparingId(null);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl bg-white border border-gray-200 p-5">
        <p className="text-sm text-gray-400">Cargando iris...</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Iris (privado, solo tu)
      </h2>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
        <p className="text-xs text-amber-800">
          ⚠️ La iridologia no esta comprobada cientificamente. Esto es
          solo orientacion personal — nunca un diagnostico.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {photos.length === 0 ? (
        <p className="text-sm text-gray-400">
          Sin fotos de iris registradas. La terapeuta puede subirlas desde
          su propia ficha del paciente.
        </p>
      ) : (
        <div className="space-y-3">
          {photos.map((photo) => {
            const relatedFindings = findings.filter((f) => f.patient_photo_id === photo.id);
            return (
              <div key={photo.id} className="rounded-xl bg-gray-50 p-3 space-y-2">
                <div className="flex items-center gap-3">
                  {photo.image_url && (
                    <Image src={photo.image_url} alt={photo.eye} width={64} height={64}
                      className="rounded-lg object-cover h-16 w-16 border border-gray-200" unoptimized />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      Ojo {photo.eye === "IZQUIERDO" ? "izquierdo" : "derecho"}
                    </p>
                    <p className="text-xs text-gray-400">{formatDateTime(photo.created_at)}</p>
                  </div>
                  <button onClick={() => handleComparar(photo.id)} disabled={comparingId === photo.id}
                    className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 transition disabled:opacity-60">
                    {comparingId === photo.id ? "Comparando..." : "Comparar con banco"}
                  </button>
                </div>

                {relatedFindings.map((f) => (
                  <div key={f.id} className="rounded-lg bg-white border border-gray-200 p-3 space-y-2">
                    <p className="text-xs text-gray-400">{formatDateTime(f.created_at)}</p>
                    <p className="text-sm text-gray-800">{f.summary}</p>
                    {f.matches.length > 0 && (
                      <ul className="space-y-1">
                        {f.matches.map((m, i) => (
                          <li key={i} className="text-xs text-gray-600">
                            <span className="font-semibold">{m.label}:</span> {m.similarity_note}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
                      {f.disclaimer}
                    </p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

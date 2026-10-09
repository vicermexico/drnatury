"use client";

import { useState, useTransition, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { IrisFindingMatch } from "@/types";

interface FindingResult {
  summary: string;
  matches: IrisFindingMatch[];
  disclaimer: string;
}

// La terapeuta sube la foto del ojo del paciente y, en esta misma
// pantalla, ve el resultado de la comparacion con el banco de Master.
// Esto es EXPERIMENTAL: la iridologia no esta comprobada
// cientificamente. Nunca se le muestra nada de esto al paciente.
export function IrisUploadPanel({ patientId }: { patientId: string }) {
  const [isPending, startTransition] = useTransition();
  const [eye, setEye] = useState<"IZQUIERDO" | "DERECHO">("IZQUIERDO");
  const [stage, setStage] = useState<"idle" | "subiendo" | "comparando">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<FindingResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no puede pesar mas de 5 MB");
      return;
    }
    setError("");
    setResult(null);

    startTransition(async () => {
      try {
        setStage("subiendo");
        const supabase = createClient();
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${patientId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("iris-photos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw new Error(upErr.message);

        const photoRes = await fetch("/api/iris/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patient_id: patientId, eye, image_path: path }),
        });
        const photoData = await photoRes.json().catch(() => ({}));
        if (!photoRes.ok) throw new Error(photoData.message || "Error al guardar la foto");

        setStage("comparando");
        const compareRes = await fetch("/api/iris/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patient_photo_id: photoData.id }),
        });
        const compareData = await compareRes.json().catch(() => ({}));
        if (!compareRes.ok) throw new Error(compareData.message || "Error al comparar");

        setResult(compareData);
        if (fileRef.current) fileRef.current.value = "";
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al procesar la foto");
      } finally {
        setStage("idle");
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Registro de iris
      </h2>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
        <p className="text-xs text-amber-800">
          ⚠️ Esto es experimental — la iridologia no esta comprobada
          cientificamente. El resultado es solo orientacion para ti, no es
          un diagnostico medico. Nunca se lo comentes al paciente como si
          fuera uno.
        </p>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setEye("IZQUIERDO")}
          className={["flex-1 rounded-xl py-2 text-sm font-medium transition",
            eye === "IZQUIERDO" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"].join(" ")}>
          Ojo izquierdo
        </button>
        <button type="button" onClick={() => setEye("DERECHO")}
          className={["flex-1 rounded-xl py-2 text-sm font-medium transition",
            eye === "DERECHO" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"].join(" ")}>
          Ojo derecho
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile}
        disabled={isPending}
        className="block w-full text-sm text-gray-600" />

      {stage === "subiendo" && <p className="text-sm text-gray-400">Subiendo foto...</p>}
      {stage === "comparando" && <p className="text-sm text-gray-400">Comparando con el banco...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-2">
          <p className="text-sm text-gray-800">{result.summary}</p>
          {result.matches?.length > 0 && (
            <ul className="space-y-1">
              {result.matches.map((m, i) => (
                <li key={i} className="text-xs text-gray-600">
                  <span className="font-semibold">{m.label}:</span> {m.similarity_note}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
            {result.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}

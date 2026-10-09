"use client";

import { useState, useTransition, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// Solo sube la foto del ojo del paciente al banco privado de Master.
// Esta pantalla NUNCA muestra ningun resultado, comparacion ni
// posible padecimiento — eso es exclusivo de Master.
export function IrisUploadPanel({ patientId }: { patientId: string }) {
  const [isPending, startTransition] = useTransition();
  const [eye, setEye] = useState<"IZQUIERDO" | "DERECHO">("IZQUIERDO");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no puede pesar mas de 5 MB");
      return;
    }
    setError("");
    setSuccess("");

    startTransition(async () => {
      try {
        const supabase = createClient();
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${patientId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("iris-photos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw new Error(upErr.message);

        const res = await fetch("/api/iris/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patient_id: patientId, eye, image_path: path }),
        });
        if (!res.ok) throw new Error("Error al guardar");

        setSuccess(`Foto del ojo ${eye === "IZQUIERDO" ? "izquierdo" : "derecho"} subida`);
        if (fileRef.current) fileRef.current.value = "";
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al subir la foto");
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Registro de iris
      </h2>
      <p className="text-xs text-gray-400">
        Sube la foto del ojo del paciente. Esta informacion es privada.
      </p>

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

      {isPending && <p className="text-sm text-gray-400">Subiendo...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">✓ {success}</p>}
    </div>
  );
}

"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Config {
  id: string;
  video_fondo_url: string | null;
  video_resultado_url: string | null;
}

export function PhRevisionConfig({ config }: { config: Config | null }) {
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [urls, setUrls] = useState({
    video_fondo: config?.video_fondo_url ?? "",
    video_resultado: config?.video_resultado_url ?? "",
  });

  async function handleUpload(file: File, tipo: string) {
    setUploading(tipo);
    setError("");
    try {
      // Paso 1: pedirle al servidor un permiso de subida.
      const ext = file.name.split(".").pop() || "bin";
      const res = await fetch("/api/ph-revision/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, ext }),
      });
      const data = (await res.json()) as {
        path?: string;
        token?: string;
        publicUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.path || !data.token || !data.publicUrl) {
        setError("No se pudo iniciar la subida. Intenta de nuevo.");
        return;
      }

      // Paso 2: subir el archivo DIRECTO a Supabase, sin pasar por Vercel.
      const supabase = createClient();
      const { error: uploadErr } = await supabase.storage
        .from("ph-revision")
        .uploadToSignedUrl(data.path, data.token, file, {
          contentType: file.type,
        });

      if (uploadErr) {
        setError("Error al subir el archivo: " + uploadErr.message);
        return;
      }

      // Paso 3: avisarle al servidor la URL final para que la guarde.
      await fetch("/api/ph-revision/upload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, url: data.publicUrl }),
      });

      setUrls(prev => ({ ...prev, [tipo]: data.publicUrl! }));
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">Videos</h2>
        {[
          {
            key: "video_fondo",
            label: "Video de fondo (pantalla de espera, antes de dar clic en Iniciar)",
            hint: "Se ve tenue de fondo, detras del boton Iniciar.",
            accept: "video/*",
          },
          {
            key: "video_resultado",
            label: "Video del analisis (lado derecho, mientras se hace la revision)",
            hint: "Cuando este video termine, la pantalla pasa sola a \"Finalizado\".",
            accept: "video/*",
          },
        ].map(({ key, label, hint, accept }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <p className="text-xs text-gray-400 mb-1.5">{hint}</p>
            <div className="flex gap-2 items-center">
              <input type="file" accept={accept}
                onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], key)}
                className="text-sm text-gray-600" />
              {uploading === key && <span className="text-xs text-blue-500">Subiendo...</span>}
            </div>
            {urls[key as keyof typeof urls] && (
              <p className="text-xs text-green-600 mt-1 truncate">✓ {urls[key as keyof typeof urls]}</p>
            )}
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
    </div>
  );
}

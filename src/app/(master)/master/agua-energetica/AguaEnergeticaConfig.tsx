"use client";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
interface Horario { inicio: string; fin: string; }
interface Config {
  id: string;
  video_espera_url: string | null;
  imagen_activa_url: string | null;
  video_sesion_url: string | null;
  dias_activacion: number;
  comision_monto: number;
  horarios: Horario[];
  requisitos: string | null;
}
export function AguaEnergeticaConfig({ config }: { config: Config | null }) {
  const [isPending, startTransition] = useTransition();
  const [dias, setDias] = useState(String(config?.dias_activacion ?? 21));
  const [comision, setComision] = useState(String(config?.comision_monto ?? 0));
  const [horarios, setHorarios] = useState<Horario[]>(config?.horarios ?? []);
  const [requisitos, setRequisitos] = useState(config?.requisitos ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [urls, setUrls] = useState({
    video_espera: config?.video_espera_url ?? "",
    imagen_activa: config?.imagen_activa_url ?? "",
    video_sesion: config?.video_sesion_url ?? "",
  });
  function addHorario() {
    setHorarios(prev => [...prev, { inicio: "08:00", fin: "10:00" }]);
  }
  function updateHorario(i: number, field: "inicio" | "fin", value: string) {
    setHorarios(prev => prev.map((h, idx) => idx === i ? { ...h, [field]: value } : h));
  }
  function removeHorario(i: number) {
    setHorarios(prev => prev.filter((_, idx) => idx !== i));
  }
  async function handleUpload(file: File, tipo: string) {
    setUploading(tipo);
    setError("");
    try {
      // Paso 1: pedirle al servidor un permiso de subida (esto es texto,
      // pesa nada, no tiene problema con limites de tamano).
      const ext = file.name.split(".").pop() || "bin";
      const res = await fetch("/api/agua-energetica/upload", {
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
      // Asi los videos grandes ya no tienen problema de tamano.
      const supabase = createClient();
      const { error: uploadErr } = await supabase.storage
        .from("agua-energetica")
        .uploadToSignedUrl(data.path, data.token, file, {
          contentType: file.type,
        });

      if (uploadErr) {
        setError("Error al subir el archivo: " + uploadErr.message);
        return;
      }

      // Paso 3: avisarle al servidor la URL final para que la guarde.
      await fetch("/api/agua-energetica/upload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, url: data.publicUrl }),
      });

      setUrls(prev => ({ ...prev, [tipo]: data.publicUrl! }));
    } finally {
      setUploading(null);
    }
  }
  function handleSave() {
    setError(""); setSuccess("");
    startTransition(async () => {
      const res = await fetch("/api/agua-energetica/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dias_activacion: parseInt(dias),
          comision_monto: parseFloat(comision),
          horarios,
          requisitos: requisitos.trim() || null,
        }),
      });
      if (!res.ok) { setError("Error al guardar"); return; }
      setSuccess("Configuracion guardada");
      setTimeout(() => setSuccess(""), 3000);
    });
  }
  return (
    <div className="space-y-6">
      {/* Videos e imagen */}
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">Contenido multimedia</h2>
        {[
          { key: "video_espera", label: "Video de espera (pantalla completa si no activo)", accept: "video/*" },
          { key: "imagen_activa", label: "Imagen/GIF cuando esta activo", accept: "image/*,video/*" },
          { key: "video_sesion", label: "Video de sesion (al dar clic en Iniciar)", accept: "video/*" },
        ].map(({ key, label, accept }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
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
      {/* Horarios */}
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Horarios de activacion</h2>
        <p className="text-xs text-gray-400">En estos horarios el boton Iniciar estara disponible</p>
        {horarios.map((h, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-8">De</span>
            <input type="time" value={h.inicio} onChange={e => updateHorario(i, "inicio", e.target.value)}
              style={{ color: "black" }}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none" />
            <span className="text-xs text-gray-500">a</span>
            <input type="time" value={h.fin} onChange={e => updateHorario(i, "fin", e.target.value)}
              style={{ color: "black" }}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none" />
            <button onClick={() => removeHorario(i)} className="text-red-400 hover:text-red-600 text-lg">×</button>
          </div>
        ))}
        <button onClick={addHorario} className="text-sm text-blue-600 font-medium">+ Agregar horario</button>
      </div>
      {/* Dias y comision */}
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">Activacion</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dias de duracion</label>
            <input type="number" min="1" value={dias} onChange={e => setDias(e.target.value)}
              style={{ color: "black" }}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Comision por activacion ($)</label>
            <input type="number" min="0" value={comision} onChange={e => setComision(e.target.value)}
              style={{ color: "black" }}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none" />
          </div>
        </div>
      </div>
      {/* Requisitos */}
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Requisitos y terminos</h2>
        <p className="text-xs text-gray-400">El paciente debe aceptar esto antes de solicitar el servicio</p>
        <textarea value={requisitos} onChange={e => setRequisitos(e.target.value)} rows={4}
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none resize-none" />
      </div>
      {error   && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {success && <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">✓ {success}</p>}
      <button onClick={handleSave} disabled={isPending}
        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
        {isPending ? "Guardando..." : "Guardar configuracion"}
      </button>
    </div>
  );
}

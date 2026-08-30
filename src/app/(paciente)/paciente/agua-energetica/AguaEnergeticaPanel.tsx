"use client";
import { useState, useEffect, useRef } from "react";
interface Horario { inicio: string; fin: string; }
interface Config {
  video_espera_url: string | null;
  imagen_activa_url: string | null;
  video_sesion_url: string | null;
  horarios: Horario[];
  requisitos: string | null;
}
interface Activacion {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
}
function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
}
function estaEnHorario(horarios: Horario[], now: Date): boolean {
  const cst = new Date(now.toLocaleString("en-US", { timeZone: "America/Monterrey" }));
  const hh = cst.getHours();
  const mm = cst.getMinutes();
  const totalMin = hh * 60 + mm;
  return horarios.some(h => {
    const [ih, im] = h.inicio.split(":").map(Number);
    const [fh, fm] = h.fin.split(":").map(Number);
    return totalMin >= ih * 60 + im && totalMin < fh * 60 + fm;
  });
}
function proximoHorario(horarios: Horario[], now: Date): Date | null {
  const cst = new Date(now.toLocaleString("en-US", { timeZone: "America/Monterrey" }));
  const hh = cst.getHours();
  const mm = cst.getMinutes();
  const totalMin = hh * 60 + mm;
  const sorted = [...horarios].sort((a, b) => {
    const [ah, am] = a.inicio.split(":").map(Number);
    const [bh, bm] = b.inicio.split(":").map(Number);
    return ah * 60 + am - (bh * 60 + bm);
  });
  for (const h of sorted) {
    const [ih, im] = h.inicio.split(":").map(Number);
    const inicioMin = ih * 60 + im;
    if (inicioMin > totalMin) {
      const proximo = new Date(cst);
      proximo.setHours(ih, im, 0, 0);
      return proximo;
    }
  }
  // Siguiente dia primer horario
  if (sorted.length > 0) {
    const [ih, im] = sorted[0].inicio.split(":").map(Number);
    const proximo = new Date(cst);
    proximo.setDate(proximo.getDate() + 1);
    proximo.setHours(ih, im, 0, 0);
    return proximo;
  }
  return null;
}
function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
function formatDiasRestantes(fechaFin: string, now: Date): string {
  const fin = new Date(fechaFin);
  const diff = fin.getTime() - now.getTime();
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (dias > 0) return `${dias} dia${dias !== 1 ? "s" : ""} y ${horas} hora${horas !== 1 ? "s" : ""}`;
  return `${horas} hora${horas !== 1 ? "s" : ""}`;
}
export function AguaEnergeticaPanel({ config, activacion }: {
  config: Config | null;
  activacion: Activacion | null;
  patientId: string;
}) {
  const now = useNow();
  const [step, setStep] = useState<"idle" | "video">("idle");
  const videoRef = useRef<HTMLVideoElement>(null);
  const activo = activacion !== null && new Date(activacion.fecha_fin) > now;
  const enHorario = activo && estaEnHorario(config?.horarios ?? [], now);
  const proximo = activo ? proximoHorario(config?.horarios ?? [], now) : null;
  const msProximo = proximo ? proximo.getTime() - now.getTime() : 0;
  function handleIniciar() {
    setStep("video");
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.muted = false;
        videoRef.current.play().catch(() => {});
      }
    }, 100);
  }
  function handleVideoEnd() {
    setStep("idle");
  }
  // Video de sesion
  if (step === "video" && config?.video_sesion_url) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <video
          ref={videoRef}
          src={config.video_sesion_url}
          autoPlay
          playsInline
          onEnded={handleVideoEnd}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  // Sin activacion — video de espera pantalla completa
  if (!activo) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        {config?.video_espera_url ? (
          <video
            src={config.video_espera_url}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center text-white space-y-4 p-8">
            <p className="text-6xl">🥛</p>
            <h1 className="text-2xl font-bold">Agua Energetica</h1>
            <p className="text-gray-400">Servicio no activo. Contacta a tu terapeuta para activarlo.</p>
          </div>
        )}
      </div>
    );
  }
  // Con activacion
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 to-blue-900 flex flex-col">
      {/* Tiempo restante de activacion */}
      <div className="text-center pt-8 pb-4 px-4">
        <p className="text-blue-300 text-xs font-medium uppercase tracking-wide">Tu servicio vence en</p>
        <p className="text-white text-lg font-bold mt-1">
          {formatDiasRestantes(activacion!.fecha_fin, now)}
        </p>
      </div>
      {/* Imagen/gif activo */}
      <div className="flex-1 flex items-center justify-center px-6">
        {config?.imagen_activa_url ? (
          config.imagen_activa_url.match(/\.(mp4|webm|mov)$/i) ? (
            <video src={config.imagen_activa_url} autoPlay loop muted playsInline
              className="w-full max-w-sm rounded-3xl shadow-2xl" />
          ) : (
            <img src={config.imagen_activa_url} alt="Agua Energetica"
              className="w-full max-w-sm rounded-3xl shadow-2xl" />
          )
        ) : (
          <div className="text-8xl">🥛</div>
        )}
      </div>
      {/* Boton iniciar o contador */}
      <div className="px-6 pb-12 pt-4 space-y-4">
        {enHorario ? (
          <button onClick={handleIniciar}
            className="w-full rounded-2xl bg-emerald-400 py-5 text-lg font-bold text-white shadow-lg hover:bg-emerald-500 transition active:scale-95">
            🥛 Iniciar
          </button>
        ) : (
          <div className="text-center space-y-2">
            <p className="text-blue-300 text-sm">Proxima activacion en</p>
            <p className="text-white text-5xl font-bold tracking-wider font-mono">
              {formatCountdown(msProximo)}
            </p>
            {proximo && (
              <p className="text-blue-400 text-xs">
                {proximo.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Monterrey" })}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

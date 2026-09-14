"use client";
import { useEffect, useRef, useState } from "react";

interface Config {
  video_fondo_url: string | null;
  video_resultado_url: string | null;
}

const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function randomCode(len = 9): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    if (i === 4) out += "-";
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

const INDICADOR_COLORES = ["#22c55e", "#eab308", "#f97316", "#ef4444"];

export function PhRevisionPanel({ config }: { config: Config | null }) {
  const [step, setStep] = useState<"idle" | "escaneando" | "finalizado">("idle");
  const [codigo, setCodigo] = useState(randomCode());
  const [codigoFinal, setCodigoFinal] = useState("");
  const [colorIndicador, setColorIndicador] = useState(INDICADOR_COLORES[0]);
  const videoResultadoRef = useRef<HTMLVideoElement>(null);

  // Mientras esta "escaneando": el codigo localizador cambia random
  // constantemente, y el indicador de color va rotando, para dar
  // sensacion de analisis en vivo.
  useEffect(() => {
    if (step !== "escaneando") return;
    const codigoInterval = setInterval(() => setCodigo(randomCode()), 120);
    const colorInterval = setInterval(() => {
      setColorIndicador(prev => {
        const idx = INDICADOR_COLORES.indexOf(prev);
        return INDICADOR_COLORES[(idx + 1) % INDICADOR_COLORES.length];
      });
    }, 700);
    return () => {
      clearInterval(codigoInterval);
      clearInterval(colorInterval);
    };
  }, [step]);

  function handleIniciar() {
    setStep("escaneando");
    setTimeout(() => {
      if (videoResultadoRef.current) {
        videoResultadoRef.current.muted = false;
        videoResultadoRef.current.play().catch(() => {});
      }
    }, 100);
  }

  function handleVideoResultadoEnd() {
    setCodigoFinal(randomCode());
    setStep("finalizado");
  }

  function handleNuevaRevision() {
    setStep("idle");
    setCodigo(randomCode());
  }

  // ------------------------------------------------------------------
  // Pantalla 1: espera — video de fondo tenue + boton Iniciar pulsando
  // ------------------------------------------------------------------
  if (step === "idle") {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center overflow-hidden">
        {config?.video_fondo_url && (
          <video
            src={config.video_fondo_url}
            autoPlay loop muted playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="text-center">
            <p className="text-white text-2xl font-bold">Revision de PH</p>
            <p className="text-gray-300 text-sm mt-1">Da clic en Iniciar para comenzar</p>
          </div>
          <button
            onClick={handleIniciar}
            className="ph-pulse rounded-full px-12 py-5 text-xl font-bold text-white shadow-2xl active:scale-95 transition-transform"
          >
            Iniciar
          </button>
        </div>
        <style>{`
          @keyframes ph-pulse-color {
            0%, 100% { background-color: #0d9488; box-shadow: 0 0 20px 4px rgba(13,148,136,0.6); }
            50% { background-color: #22d3ee; box-shadow: 0 0 32px 10px rgba(34,211,238,0.8); }
          }
          .ph-pulse { animation: ph-pulse-color 1.6s ease-in-out infinite; }
        `}</style>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Pantalla 2: escaneando — codigo localizador + analisis + video
  // ------------------------------------------------------------------
  if (step === "escaneando") {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden">
        <div className="shrink-0 text-center pt-8 pb-4 px-4">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Localizador de formula</p>
          <p className="text-white text-3xl font-mono font-bold tracking-widest mt-1">{codigo}</p>
        </div>
        <div className="flex-1 min-h-0 flex flex-row">
          {/* Lado izquierdo: analizando + indicador de color */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-3 border-r border-white/10">
            <p className="text-white text-xl sm:text-3xl font-bold text-center leading-tight">
              Analizando
              <br />
              cuero graso
            </p>
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full transition-colors duration-700"
              style={{ backgroundColor: colorIndicador, boxShadow: `0 0 30px 6px ${colorIndicador}88` }}
            />
          </div>
          {/* Lado derecho: video que sube Master */}
          <div className="flex-1 flex items-center justify-center px-3">
            {config?.video_resultado_url ? (
              <video
                ref={videoResultadoRef}
                src={config.video_resultado_url}
                autoPlay playsInline
                onEnded={handleVideoResultadoEnd}
                className="w-full h-full max-h-[70vh] object-cover rounded-2xl"
              />
            ) : (
              <p className="text-gray-500 text-sm text-center px-4">
                Master aun no sube el video de analisis.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Pantalla 3: finalizado
  // ------------------------------------------------------------------
  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div className="text-center space-y-4 px-6">
        <p className="text-emerald-400 text-4xl">✓</p>
        <p className="text-white text-3xl font-bold">Finalizado</p>
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-widest">Codigo de formula</p>
          <p className="text-white text-2xl font-mono font-bold tracking-widest mt-1">{codigoFinal}</p>
        </div>
        <button
          onClick={handleNuevaRevision}
          className="mt-4 rounded-2xl bg-teal-600 hover:bg-teal-700 transition px-8 py-3 text-base font-semibold text-white"
        >
          Nueva revision
        </button>
      </div>
    </div>
  );
}

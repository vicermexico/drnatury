"use client";
import { useEffect, useRef, useState } from "react";

// Reproduce un video con fondo transparente (el fondo verde ya se le
// quito al subirlo, ver RecorteVerdeVideo.tsx) -- un <video> normal NO
// muestra la transparencia aunque el archivo la tenga, asi que aqui se
// dibuja cuadro por cuadro en un <canvas>, que si la respeta.
//
// No arranca solo: primero se ve un cuadro gris con un boton de play
// (igual que el audio de bienvenida) y, hasta que le dan clic, aparece
// el video de verdad reproduciendose YA CON SONIDO -- asi se evita el
// problema de que los celulares bloquean el audio automatico.
interface Props {
  src: string;
  className?: string;
}

export function VideoTransparente({ src, className }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [iniciado, setIniciado] = useState(false);
  const [terminado, setTerminado] = useState(false);

  useEffect(() => {
    if (!iniciado) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let activo = true;

    function dibujarCuadro() {
      if (!activo || !video || video.paused || video.ended) return;
      if (canvas!.width !== video.videoWidth && video.videoWidth > 0) {
        canvas!.width = video.videoWidth;
        canvas!.height = video.videoHeight;
      }
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.drawImage(video, 0, 0, canvas!.width, canvas!.height);
      if ("requestVideoFrameCallback" in video) {
        video.requestVideoFrameCallback(dibujarCuadro);
      } else {
        requestAnimationFrame(dibujarCuadro);
      }
    }

    video.addEventListener("play", dibujarCuadro);
    video.muted = false;
    video.play().catch(() => {});

    return () => {
      activo = false;
      video.removeEventListener("play", dibujarCuadro);
    };
  }, [src, iniciado]);

  if (!iniciado) {
    return (
      <div className={`w-full ${className ?? ""}`}>
        <button
          onClick={() => setIniciado(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 py-6 text-gray-600 hover:bg-gray-200"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">▶️</span>
          <span className="text-sm font-medium">Ver video</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${className ?? ""}`}>
      <video ref={videoRef} src={src} playsInline className="hidden" onEnded={() => setTerminado(true)} />
      <canvas ref={canvasRef} className="w-full h-auto block" />
      {terminado && (
        <button
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            video.currentTime = 0;
            setTerminado(false);
            video.play().catch(() => {});
          }}
          className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white hover:bg-black/75"
        >
          🔁 Volver a verlo
        </button>
      )}
    </div>
  );
}

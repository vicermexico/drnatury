"use client";
import { useEffect, useRef, useState } from "react";

// Reproduce un video con fondo transparente (el fondo verde ya se le
// quito al subirlo, ver RecorteVerdeVideo.tsx).
//
// El video NO trae la transparencia nativa del formato (eso no es
// confiable en todos los celulares, sobre todo iPhone -- se ve negro
// feo en vez de transparente). En vez de eso, el archivo viene grabado
// al DOBLE de ancho: la mitad izquierda trae los colores normales, la
// mitad derecha trae una "mascara" en blanco y negro que dice que tan
// transparente es cada pixel (blanco = se ve, negro = transparente).
// Aqui se dibuja cada cuadro en un canvas oculto para leerlo, se
// separan las dos mitades, y se vuelven a juntar en el canvas visible
// usando la mascara como transparencia real -- eso si lo soporta
// cualquier navegador, sobre cualquier fondo (ver quitarVerdeConMascara).
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
  const lecturaRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [iniciado, setIniciado] = useState(false);
  const [terminado, setTerminado] = useState(false);

  useEffect(() => {
    if (!iniciado) return;
    const video = videoRef.current;
    const lectura = lecturaRef.current;
    const canvas = canvasRef.current;
    if (!video || !lectura || !canvas) return;
    const ctxLectura = lectura.getContext("2d", { willReadFrequently: true });
    const ctx = canvas.getContext("2d");
    if (!ctxLectura || !ctx) return;
    let activo = true;

    function dibujarCuadro() {
      if (!activo || !video || video.paused || video.ended) return;
      const anchoTotal = video.videoWidth;
      const alto = video.videoHeight;
      const anchoMitad = Math.floor(anchoTotal / 2);
      if (anchoMitad <= 0 || alto <= 0) {
        siguienteCuadro();
        return;
      }
      if (lectura!.width !== anchoTotal) {
        lectura!.width = anchoTotal;
        lectura!.height = alto;
      }
      if (canvas!.width !== anchoMitad) {
        canvas!.width = anchoMitad;
        canvas!.height = alto;
      }
      ctxLectura!.drawImage(video, 0, 0);
      const cuadro = ctxLectura!.getImageData(0, 0, anchoTotal, alto);
      const salida = new Uint8ClampedArray(anchoMitad * alto * 4);
      for (let y = 0; y < alto; y++) {
        const filaOrigen = y * anchoTotal * 4;
        const filaSalida = y * anchoMitad * 4;
        for (let x = 0; x < anchoMitad; x++) {
          const iColor = filaOrigen + x * 4;
          const iMascara = filaOrigen + (anchoMitad + x) * 4;
          const iSalida = filaSalida + x * 4;
          salida[iSalida] = cuadro.data[iColor];
          salida[iSalida + 1] = cuadro.data[iColor + 1];
          salida[iSalida + 2] = cuadro.data[iColor + 2];
          salida[iSalida + 3] = cuadro.data[iMascara]; // canal rojo de la mascara = que tan visible es
        }
      }
      ctx!.putImageData(new ImageData(salida, anchoMitad, alto), 0, 0);
      siguienteCuadro();
    }

    function siguienteCuadro() {
      if (!video) return;
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
    // Antes de reproducirse, se ve chico y a la izquierda, igual que
    // el reproductor de audio -- no ocupa toda la pantalla (eso es
    // solo cuando ya esta reproduciendo el video de verdad, ver abajo).
    return (
      <div className={className}>
        <button
          onClick={() => setIniciado(true)}
          className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-gray-600 hover:bg-gray-200"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs">▶️</span>
          <span className="text-sm font-medium">Ver video</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${className ?? ""}`}>
      <video ref={videoRef} src={src} playsInline className="hidden" onEnded={() => setTerminado(true)} />
      <canvas ref={lecturaRef} className="hidden" />
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

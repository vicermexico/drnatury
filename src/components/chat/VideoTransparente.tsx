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
//
// Para que no se sienta lento/trabado mientras se reproduce (cada
// cuadro se tiene que leer, combinar y volver a dibujar a mano), se
// procesan como maximo 20 cuadros por segundo (de sobra para que se
// vea fluido), se combinan los canales de color+transparencia con
// numeros de 32 bits en vez de uno por uno, y el espacio donde se arma
// cada cuadro se reutiliza en vez de crear uno nuevo cada vez -- crear
// y tirar memoria 20+ veces por segundo es justo lo que hace que un
// celular mas sencillo se trabe de repente (el telefono se detiene un
// instante a "limpiar" esa memoria), aunque el audio siga sonando.
//
// Con flotante=true (el chat real y el chat de prueba del Master), el
// video -- mientras se esta reproduciendo -- se ve GRANDE encima de
// toda la pantalla (de abajo hasta arriba), pero sin bloquear que la
// persona siga escribiendo su mensaje o moviendo la pantalla del chat:
// como el fondo del video es transparente y el recuadro no "atrapa"
// los clics (pointer-events: none), todo sigue funcionando normal
// detras. Al terminar el video vuelve a verse chico, con un boton para
// repetirlo. En las pantallas de edicion (donde se recorta o revisa el
// video antes de subirlo) no se usa flotante -- ahi se ve en su tamaño
// normal, dentro del lugar donde esta puesto.
interface Props {
  src: string;
  className?: string;
  flotante?: boolean;
}

export function VideoTransparente({ src, className, flotante = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lecturaRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [iniciado, setIniciado] = useState(false);
  const [terminado, setTerminado] = useState(false);
  const [cicloId, setCicloId] = useState(0);

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
    // No hace falta procesar cada cuadro del video a su velocidad
    // nativa (a veces 30 o hasta 60 por segundo) -- con 20 por segundo
    // se ve igual de fluido para un video de alguien hablando, y le
    // quita una buena parte del trabajo al celular (menos trabazon).
    const MIN_MS_ENTRE_CUADROS = 1000 / 20;
    let ultimoProcesado = 0;

    // Se reutiliza el mismo espacio en memoria para armar cada cuadro
    // (en vez de crear uno nuevo cada vez) -- solo se vuelve a crear si
    // cambia el tamaño del video (algo que normalmente pasa una sola
    // vez, al arrancar).
    let salidaU8: Uint8ClampedArray<ArrayBuffer> | null = null;
    let salidaU32: Uint32Array | null = null;
    let imagenSalida: ImageData | null = null;
    let anchoBuffer = 0;
    let altoBuffer = 0;

    function obtenerBufferDeSalida(anchoMitad: number, alto: number) {
      if (salidaU8 && salidaU32 && imagenSalida && anchoBuffer === anchoMitad && altoBuffer === alto) {
        return { salidaU8, salidaU32, imagenSalida };
      }
      salidaU8 = new Uint8ClampedArray(anchoMitad * alto * 4);
      salidaU32 = new Uint32Array(salidaU8.buffer);
      imagenSalida = new ImageData(salidaU8, anchoMitad, alto);
      anchoBuffer = anchoMitad;
      altoBuffer = alto;
      return { salidaU8, salidaU32, imagenSalida };
    }

    function dibujarCuadro() {
      if (!activo || !video || video.paused || video.ended) return;
      const ahoraMs = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (ahoraMs - ultimoProcesado < MIN_MS_ENTRE_CUADROS) {
        siguienteCuadro();
        return;
      }
      ultimoProcesado = ahoraMs;
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
      try {
        ctxLectura!.drawImage(video, 0, 0);
        const cuadro = ctxLectura!.getImageData(0, 0, anchoTotal, alto);
        // Para que no se sienta lento/trabado al reproducirse, en vez
        // de copiar los 4 canales (R, G, B, A) uno por uno con un
        // array normal, se "ve" el mismo bloque de memoria como
        // numeros de 32 bits (un numero = un pixel completo). Asi se
        // copia el pixel de color entero de un solo jalon y nomas se
        // le cambia el ultimo byte (la transparencia) por el de la
        // mascara -- son muchas menos operaciones por cuadro.
        const origenU8 = cuadro.data;
        const origenU32 = new Uint32Array(origenU8.buffer, origenU8.byteOffset, origenU8.length / 4);
        const { salidaU32: salidaU32Buf, imagenSalida: imagenSalidaBuf } = obtenerBufferDeSalida(anchoMitad, alto);
        for (let y = 0; y < alto; y++) {
          const filaOrigenPix = y * anchoTotal;
          const filaSalidaPix = y * anchoMitad;
          for (let x = 0; x < anchoMitad; x++) {
            const colorPix = filaOrigenPix + x;
            const mascaraByte = (filaOrigenPix + anchoMitad + x) * 4; // canal rojo de la mascara = que tan visible es
            salidaU32Buf[filaSalidaPix + x] = (origenU32[colorPix] & 0x00ffffff) | (origenU8[mascaraByte] << 24);
          }
        }
        ctx!.putImageData(imagenSalidaBuf, 0, 0);
      } catch (err) {
        // Si por algun motivo el navegador bloquea leer el video (ej.
        // CORS), se avisa en la consola en vez de quedarse "pegado" sin
        // decir nada -- el audio sigue sonando igual (eso no pasa por
        // aqui), solo no se verá el video.
        console.error("No se pudo dibujar el cuadro del video:", err);
        return;
      }
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
    // cicloId cambia cada vez que se vuelve a dar play despues de haber
    // terminado, para que este efecto se vuelva a conectar al video
    // (que es un elemento nuevo del DOM en ese momento).
  }, [src, iniciado, cicloId]);

  function reproducir() {
    setTerminado(false);
    setCicloId((c) => c + 1);
    setIniciado(true);
  }

  if (!iniciado || terminado) {
    // Antes de reproducirse (o despues de haber terminado), se ve
    // chico y a la izquierda, igual que el reproductor de audio -- no
    // ocupa toda la pantalla.
    return (
      <div className={className}>
        <button
          onClick={reproducir}
          className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-gray-600 hover:bg-gray-200"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs">
            {terminado ? "🔁" : "▶️"}
          </span>
          <span className="text-sm font-medium">{terminado ? "Volver a verlo" : "Ver video"}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={
        flotante
          ? "fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          : `relative w-full ${className ?? ""}`
      }
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        // Sin esto, el navegador bloquea por seguridad (CORS) que se
        // pueda "leer" el video para dibujarlo cuadro por cuadro en el
        // canvas, porque viene de otro dominio (el storage de
        // Supabase) -- se sigue escuchando el audio normal (eso no
        // pasa por el canvas), pero el dibujo se cae en silencio y no
        // se ve nada. El storage de Supabase ya manda los permisos de
        // CORS necesarios, solo faltaba pedirlo aqui.
        crossOrigin="anonymous"
        className="hidden"
        onEnded={() => setTerminado(true)}
      />
      <canvas ref={lecturaRef} className="hidden" />
      <canvas
        ref={canvasRef}
        className={flotante ? "h-full max-h-screen w-auto max-w-full object-contain" : "w-full h-auto block"}
      />
    </div>
  );
}

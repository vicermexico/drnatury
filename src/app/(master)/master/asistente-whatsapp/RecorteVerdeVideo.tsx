"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { quitarVerdeCuadro, quitarVerdeConMascara } from "@/lib/landing/quitar-verde";
import { VideoTransparente } from "@/components/chat/VideoTransparente";

// Sube un video con fondo verde, le quita el verde cuadro por cuadro EN
// EL NAVEGADOR (mismo algoritmo que ya se usa para fotos en
// RecorteVerde.tsx -- sin IA, sin servidor) y lo agrega a la serie de
// bienvenida del chat como un mensaje de tipo "video".
//
// A diferencia de la foto (que se procesa al instante), el video se
// "reproduce" una vez por dentro mientras se va grabando el resultado
// ya sin verde -- por eso tarda mas o menos lo mismo que dura el video.
//
// IMPORTANTE sobre la transparencia: los videos NO pueden traer
// transparencia de verdad de forma confiable (varia segun el
// navegador/celular -- en varios, sobre todo iPhone, se ve negro feo
// en vez de transparente). Por eso aqui se graba el video al DOBLE de
// ancho: la mitad izquierda trae los colores normales, la mitad
// derecha trae una "mascara" en blanco y negro que dice que tan
// transparente es cada pixel (ver quitarVerdeConMascara). Quien
// reproduce el video (VideoTransparente.tsx) vuelve a juntar las dos
// mitades con un canvas, que si soporta transparencia de verdad en
// cualquier fondo. Al final, antes de guardarlo, se convierte a mp4
// (con la libreria ffmpeg.wasm, 100% en el navegador) para que se
// reproduzca bien en cualquier celular, incluyendo iPhone.
// Nota sobre el tamano: como el cuadro se graba al DOBLE de ancho
// (color + mascara, ver arriba), convertirlo a mp4 tarda bastante mas
// de lo que uno esperaria para un video de este tamano -- por eso aqui
// se usa un tamano mas chico que en un video normal (igual se ve bien
// en el chat, que no es tan ancho).
const LADO_MAXIMO = 640;

// HTMLVideoElement.captureStream no es parte del estandar (solo Chrome
// lo trae, los demas navegadores todavia no) -- por eso no esta en los
// tipos de TypeScript y hay que declararlo aparte.
interface VideoConCaptura extends HTMLVideoElement {
  captureStream?: () => MediaStream;
}

function elegirMimeSoportado(): string {
  const candidatos = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp9", "video/webm"];
  for (const c of candidatos) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "video/webm";
}

interface Props {
  onGuardado: () => void;
}

export function RecorteVerdeVideo({ onGuardado }: Props) {
  const [archivoUrl, setArchivoUrl] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [fuerza, setFuerza] = useState(50);
  const [cuadroOriginal, setCuadroOriginal] = useState<ImageData | null>(null);
  const [estado, setEstado] = useState<"elegir" | "calibrando" | "procesando" | "listo" | "guardando">("elegir");
  const [progreso, setProgreso] = useState(0);
  const [resultadoUrl, setResultadoUrl] = useState<string | null>(null);
  const [resultadoBlob, setResultadoBlob] = useState<Blob | null>(null);
  const [convirtiendo, setConvirtiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoCalibRef = useRef<HTMLVideoElement>(null);
  const lienzoCalibRef = useRef<HTMLCanvasElement>(null);
  const videoProcRef = useRef<HTMLVideoElement>(null);
  const lienzoProcRef = useRef<HTMLCanvasElement>(null);
  const entradaRef = useRef<HTMLInputElement>(null);
  const trozosRef = useRef<Blob[]>([]);

  // Vista previa de un solo cuadro (con el verde ya quitado) para que
  // Vic ajuste la barra de fuerza ANTES de procesar el video completo
  // -- asi no hay que esperar a que termine para darse cuenta de que
  // quedo mal.
  const cuadroProcesado = useMemo(
    () => (cuadroOriginal ? quitarVerdeCuadro(new Uint8ClampedArray(cuadroOriginal.data), fuerza) : null),
    [cuadroOriginal, fuerza]
  );

  useEffect(() => {
    const canvas = lienzoCalibRef.current;
    if (!canvas || !cuadroOriginal || !cuadroProcesado) return;
    canvas.width = cuadroOriginal.width;
    canvas.height = cuadroOriginal.height;
    const copia = new ImageData(new Uint8ClampedArray(cuadroProcesado), cuadroOriginal.width, cuadroOriginal.height);
    canvas.getContext("2d")?.putImageData(copia, 0, 0);
  }, [cuadroOriginal, cuadroProcesado]);

  async function elegir(archivo: File | undefined) {
    setError(null);
    setCuadroOriginal(null);
    setResultadoUrl(null);
    setResultadoBlob(null);
    if (!archivo) return;

    const url = URL.createObjectURL(archivo);
    setArchivoUrl(url);
    setNombreArchivo(archivo.name);

    const video = videoCalibRef.current;
    if (!video) return;
    video.src = url;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, video.duration / 2 || 0);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      const escala = Math.min(1, LADO_MAXIMO / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * escala));
      canvas.height = Math.max(1, Math.round(video.videoHeight * escala));
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setError("No pude leer ese video.");
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setCuadroOriginal(ctx.getImageData(0, 0, canvas.width, canvas.height));
      setEstado("calibrando");
    };
  }

  async function procesarVideoCompleto() {
    const videoOrigen = videoCalibRef.current;
    const videoProc = videoProcRef.current as VideoConCaptura | null;
    const canvas = lienzoProcRef.current;
    if (!videoOrigen || !videoProc || !canvas || !archivoUrl) return;

    setError(null);
    setEstado("procesando");
    setProgreso(0);
    trozosRef.current = [];

    // El lienzo de grabacion mide el DOBLE de ancho: izquierda = color,
    // derecha = mascara de transparencia (ver nota arriba y
    // quitarVerdeConMascara).
    // IMPORTANTE: ancho y alto tienen que quedar PARES -- el paso de
    // convertir a mp4 (mas abajo) usa un codec de video (h264) que
    // exige medidas pares, si no, falla (o en algunos casos arma un
    // video corrupto en vez de avisar el error). Por eso se redondea
    // hacia abajo al numero par mas cercano.
    const escala = Math.min(1, LADO_MAXIMO / Math.max(videoOrigen.videoWidth, videoOrigen.videoHeight));
    const anchoCrudo = Math.max(2, Math.round(videoOrigen.videoWidth * escala));
    const altoCrudo = Math.max(2, Math.round(videoOrigen.videoHeight * escala));
    const anchoMitad = anchoCrudo % 2 === 0 ? anchoCrudo : anchoCrudo - 1;
    const altoCuadro = altoCrudo % 2 === 0 ? altoCrudo : altoCrudo - 1;
    canvas.width = anchoMitad * 2;
    canvas.height = altoCuadro;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !canvas.captureStream) {
      setError("Tu navegador no puede procesar video aquí. Prueba desde una computadora con Chrome.");
      setEstado("calibrando");
      return;
    }

    // Lienzo aparte (oculto) nada mas para leer el cuadro original a
    // su tamano final, antes de armar la version con mascara.
    const lienzoLectura = document.createElement("canvas");
    lienzoLectura.width = anchoMitad;
    lienzoLectura.height = altoCuadro;
    const ctxLectura = lienzoLectura.getContext("2d", { willReadFrequently: true });

    videoProc.src = archivoUrl;
    videoProc.muted = false;
    videoProc.volume = 0; // no se oye mientras se procesa, pero el audio si se grava

    function dibujarCuadro() {
      if (!videoProc || !ctxLectura || videoProc.paused || videoProc.ended) return;
      ctxLectura.drawImage(videoProc, 0, 0, anchoMitad, altoCuadro);
      const cuadro = ctxLectura.getImageData(0, 0, anchoMitad, altoCuadro);
      const conMascara = quitarVerdeConMascara(new Uint8ClampedArray(cuadro.data), anchoMitad, altoCuadro, fuerza);
      ctx!.putImageData(new ImageData(new Uint8ClampedArray(conMascara.datos), canvas!.width, canvas!.height), 0, 0);
      if (videoProc.duration > 0) setProgreso(Math.min(99, Math.round((videoProc.currentTime / videoProc.duration) * 100)));
      if (videoProc.requestVideoFrameCallback) {
        videoProc.requestVideoFrameCallback(dibujarCuadro);
      } else {
        requestAnimationFrame(dibujarCuadro);
      }
    }

    await new Promise<void>((resolve) => {
      videoProc.onloadedmetadata = () => resolve();
    });

    const streamVideo = canvas.captureStream(30);
    const streamAudio = videoProc.captureStream?.();
    const pistaAudio = streamAudio?.getAudioTracks()[0];
    if (pistaAudio) streamVideo.addTrack(pistaAudio);

    const grabadora = new MediaRecorder(streamVideo, { mimeType: elegirMimeSoportado() });
    grabadora.ondataavailable = (e) => {
      if (e.data.size > 0) trozosRef.current.push(e.data);
    };
    grabadora.onstop = () => {
      const blob = new Blob(trozosRef.current, { type: "video/webm" });
      trozosRef.current = [];
      void convertirAMp4(blob);
    };

    videoProc.onplay = () => dibujarCuadro();
    videoProc.onended = () => grabadora.stop();

    grabadora.start();
    try {
      await videoProc.play();
    } catch {
      setError("No se pudo reproducir el video para procesarlo.");
      setEstado("calibrando");
      grabadora.stop();
    }
  }

  // Convierte el video grabado (webm) a mp4 -- el formato que se
  // guarda al final sea el que sea, siempre tiene que verse bien en
  // CUALQUIER celular (incluyendo iPhone, que no reproduce webm). Se
  // hace 100% en el navegador con ffmpeg.wasm (gratis, sin servicio de
  // paga) -- tarda un poco mas, pero solo pasa una vez por video.
  async function convertirAMp4(blobWebm: Blob) {
    setConvirtiendo(true);
    // Esta conversion pesa bastante (descarga un archivo grande la
    // primera vez) -- en celulares con internet lento o poca memoria se
    // puede quedar pegada sin avisar nada. Por eso se le pone un limite
    // de tiempo: si en 2 minutos no termino, se avisa el error en vez
    // de dejar la pantalla atorada para siempre.
    const conLimite = <T,>(promesa: Promise<T>, segundos: number): Promise<T> =>
      Promise.race([
        promesa,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error("tiempo_agotado")), segundos * 1000)
        ),
      ]);

    try {
      await conLimite(
        (async () => {
          const { FFmpeg } = await import("@ffmpeg/ffmpeg");
          const { fetchFile, toBlobURL } = await import("@ffmpeg/util");
          const ffmpeg = new FFmpeg();
          // Los archivos de ffmpeg (pesan como 30MB) se sirven DESDE
          // NUESTRA propia pagina (carpeta public/ffmpeg-core), no desde
          // un CDN externo (unpkg) -- varios CDNs externos se bloquean o
          // fallan segun el internet/antivirus de cada quien, y eso era
          // justo lo que se estaba quedando trabado. Sirviendolo nosotros
          // mismos, no depende de que un servicio externo este disponible.
          const base = "/ffmpeg-core";
          await ffmpeg.load({
            coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
            wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
            // La libreria tambien necesita su propio "worker" (un
            // archivito aparte que corre en segundo plano) -- si no se
            // le dice bien de donde sacarlo, a veces Next.js no lo
            // empaqueta bien y se queda esperando para siempre sin
            // avisar ningun error (justo lo que se estaba viendo).
            // Por eso tambien se sirve uno mismo, ya armado completo.
            classWorkerURL: await toBlobURL(`${base}/worker.js`, "text/javascript"),
          });
          await ffmpeg.writeFile("entrada.webm", await fetchFile(blobWebm));
          await ffmpeg.exec([
            "-i", "entrada.webm",
            // "trunc(iw/2)*2:trunc(ih/2)*2" fuerza medidas pares por si
            // acaso -- h264 no acepta medidas impares (ver nota arriba de
            // anchoMitad/altoCuadro, donde ya se redondea, pero esto es un
            // segundo seguro).
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            // "ultrafast" en vez de "fast" -- convertir en el navegador
            // (sin la ayuda de la tarjeta de video de verdad) ya es
            // lento de por si, y el cuadro es del doble de ancho (ver
            // nota de LADO_MAXIMO) -- este preset es bastante mas
            // rapido, a cambio de un archivo un poco mas pesado (no es
            // problema aqui, el video ya es chico).
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "salida.mp4",
          ]);
          const datos = await ffmpeg.readFile("salida.mp4");
          const bytes = typeof datos === "string" ? new TextEncoder().encode(datos) : new Uint8Array(datos);
          const blobMp4 = new Blob([bytes], { type: "video/mp4" });
          setResultadoBlob(blobMp4);
          setResultadoUrl(URL.createObjectURL(blobMp4));
          setProgreso(100);
          setEstado("listo");
        })(),
        // Convertir el video en el navegador (sin tarjeta de video de
        // verdad) es lento de por si -- un video de nada mas 10
        // segundos puede tardar varios minutos. 8 minutos de limite
        // (antes eran 2, que resulto ser muy poco).
        480
      );
    } catch (err) {
      console.error("Error convirtiendo el video a mp4:", err);
      const agotado = err instanceof Error && err.message === "tiempo_agotado";
      setError(
        agotado
          ? "Se tardó más de 8 minutos convirtiendo el video -- eso ya es demasiado. Intenta con un video más corto, o revisa tu internet."
          : "No se pudo convertir el video para que se viera bien en todos los celulares. Intenta de nuevo, de preferencia desde una computadora."
      );
      setEstado("calibrando");
    } finally {
      setConvirtiendo(false);
    }
  }

  async function guardar() {
    if (!resultadoBlob) return;
    setError(null);
    setEstado("guardando");
    try {
      const file = new File([resultadoBlob], "bienvenida-video.mp4", { type: "video/mp4" });
      const res = await fetch("/api/master/bot-demo/bienvenida/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      const data = (await res.json()) as { path?: string; token?: string; publicUrl?: string; message?: string };
      if (!res.ok || !data.path || !data.token || !data.publicUrl) {
        throw new Error(data.message || "No se pudo iniciar la subida");
      }

      const supabase = createClient();
      const { error: uploadErr } = await supabase.storage
        .from("whatsapp-bot-bienvenida")
        .uploadToSignedUrl(data.path, data.token, file, { contentType: "video/mp4" });
      if (uploadErr) throw new Error(uploadErr.message);

      const res2 = await fetch("/api/master/bot-demo/bienvenida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "video", video_url: data.publicUrl }),
      });
      if (!res2.ok) throw new Error("No se pudo guardar el mensaje de bienvenida");

      limpiar();
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el video.");
      setEstado("listo");
    }
  }

  function limpiar() {
    setArchivoUrl(null);
    setNombreArchivo("");
    setCuadroOriginal(null);
    setResultadoUrl(null);
    setResultadoBlob(null);
    setEstado("elegir");
    setProgreso(0);
    if (entradaRef.current) entradaRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs text-gray-500">
        Sube un video grabado con <strong>fondo verde parejo</strong> y bien iluminado. La app le quita el
        verde sola, cuadro por cuadro, y lo agrega como un mensaje de video a la bienvenida (se ve grande,
        del ancho del chat). Los videos se ajustan automáticamente a un tamaño ligero, no hace falta que lo
        recortes tú antes.
      </p>

      {/* Videos ocultos que se usan nada mas para leer los cuadros --
          no se le muestran a Master. */}
      <video ref={videoCalibRef} className="hidden" muted playsInline />
      <video ref={videoProcRef} className="hidden" playsInline />

      {estado === "elegir" && (
        <input
          ref={entradaRef}
          type="file"
          accept="video/*"
          onChange={(e) => void elegir(e.target.files?.[0])}
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-700"
        />
      )}

      {estado === "calibrando" && cuadroOriginal && (
        <>
          <div
            className="flex max-h-[40dvh] items-center justify-center overflow-hidden rounded-xl border border-gray-300 p-2"
            style={{
              backgroundImage:
                "linear-gradient(45deg,#ddd 25%,transparent 25%),linear-gradient(-45deg,#ddd 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ddd 75%),linear-gradient(-45deg,transparent 75%,#ddd 75%)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0,0 10px,10px -10px,-10px 0",
              backgroundColor: "#fff",
            }}
          >
            <canvas ref={lienzoCalibRef} className="max-h-[36dvh] w-auto max-w-full" />
          </div>
          <p className="text-xs text-gray-500">Así se ve un cuadro del video (de muestra) -- ajusta la barra hasta que no queden bordes verdes.</p>

          <label className="flex flex-col gap-2 text-sm text-gray-700">
            Cuánto verde quitar: {fuerza}
            <input
              type="range"
              min={0}
              max={100}
              value={fuerza}
              onChange={(e) => setFuerza(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </label>

          <button
            type="button"
            onClick={() => void procesarVideoCompleto()}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Procesar video completo ({nombreArchivo})
          </button>
        </>
      )}

      {/* El video "de trabajo" (donde se lee cuadro por cuadro) y el
          lienzo donde se va grabando el resultado -- los dos ocultos,
          Vic solo ve la barra de progreso. */}
      <canvas ref={lienzoProcRef} className="hidden" />

      {estado === "procesando" && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            {convirtiendo
              ? "Convirtiendo el video para que se vea bien en cualquier celular -- esto puede tardar varios minutos, no cierres esta pantalla..."
              : `Procesando video, no cierres esta pantalla... ${progreso}%`}
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-full bg-blue-600 transition-all" style={{ width: convirtiendo ? "100%" : `${progreso}%` }} />
          </div>
        </div>
      )}

      {(estado === "listo" || estado === "guardando") && resultadoUrl && (
        <>
          <div
            className="overflow-hidden rounded-xl border border-gray-300"
            style={{
              backgroundImage:
                "linear-gradient(45deg,#ddd 25%,transparent 25%),linear-gradient(-45deg,#ddd 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ddd 75%),linear-gradient(-45deg,transparent 75%,#ddd 75%)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0,0 10px,10px -10px,-10px 0",
              backgroundColor: "#fff",
            }}
          >
            <VideoTransparente src={resultadoUrl} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={limpiar}
              disabled={estado === "guardando"}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Quedó con verde, empezar de nuevo
            </button>
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={estado === "guardando"}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {estado === "guardando" ? "Guardando..." : "Se ve bien, guardar"}
            </button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

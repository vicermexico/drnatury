"use client";

import { useRef, useState } from "react";

// El Web Speech API (SpeechRecognition) todavia no trae tipos propios
// en TypeScript/DOM -- se declara aqui lo minimo que se usa, para no
// tener que usar "any" (igual que tendria que hacerse en useDictado.ts).
interface ResultadoReconocimiento {
  isFinal: boolean;
  0: { transcript: string };
}
interface EventoReconocimiento {
  results: ArrayLike<ResultadoReconocimiento>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: EventoReconocimiento) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
interface VentanaConVoz extends Window {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
  webkitAudioContext?: typeof AudioContext;
}

// Nota de voz real (se graba y se manda el audio tal cual, como en
// WhatsApp) -- pero AL MISMO TIEMPO que se graba el audio, por dentro
// tambien se va transcribiendo lo que dice (con el reconocimiento de
// voz del propio navegador, igual que useDictado, sin ningun costo ni
// servicio externo) para que el bot sepa que contestar. La persona que
// habla nunca ve ese texto como si fuera a mandarse escrito -- nada
// mas se usa por dentro.
//
// Mientras graba, "transcripcionParcial" se va llenando en vivo (no
// hasta que termina de hablar) para poder mostrar en pantalla que si
// se esta entendiendo lo que dice.
//
// Limites (son del navegador, no de este codigo): el reconocimiento de
// voz en vivo solo funciona en Chrome/Edge -- en los demas, igual se
// graba y se manda el audio bien, nada mas no hay transcripcion (se
// manda un texto de aviso en su lugar para que el bot no se quede sin
// nada que leer).
export function useNotaDeVoz(alTerminar: (resultado: { blobUrl: string; texto: string }) => void) {
  const [grabando, setGrabando] = useState(false);
  const [transcripcionParcial, setTranscripcionParcial] = useState("");
  const [nivelAudio, setNivelAudio] = useState(0);

  const grabadoraRef = useRef<MediaRecorder | null>(null);
  const trozosRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recoRef = useRef<SpeechRecognitionLike | null>(null);
  const textoFinalRef = useRef("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animacionRef = useRef<number | null>(null);

  const soportado = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  function medirNivelAudio(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as VentanaConVoz).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx: AudioContext = new AudioCtx();
      const analizador = ctx.createAnalyser();
      analizador.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analizador);
      const datos = new Uint8Array(analizador.frequencyBinCount);
      audioCtxRef.current = ctx;
      const loop = () => {
        analizador.getByteFrequencyData(datos);
        const promedio = datos.reduce((a, b) => a + b, 0) / datos.length;
        setNivelAudio(Math.min(1, promedio / 90));
        animacionRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      // Sin medidor de nivel no pasa nada, la grabacion sigue igual.
    }
  }

  async function iniciar() {
    if (grabando || !soportado) return;
    textoFinalRef.current = "";
    setTranscripcionParcial("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      medirNivelAudio(stream);

      const mime = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm";
      const grabadora = new MediaRecorder(stream, { mimeType: mime });
      trozosRef.current = [];
      grabadora.ondataavailable = (e) => {
        if (e.data.size > 0) trozosRef.current.push(e.data);
      };
      grabadora.onstop = () => {
        const blob = new Blob(trozosRef.current, { type: mime });
        trozosRef.current = [];
        const blobUrl = URL.createObjectURL(blob);
        const texto = textoFinalRef.current.trim() || transcripcionParcial.trim();
        alTerminar({ blobUrl, texto });
      };
      grabadoraRef.current = grabadora;
      grabadora.start();

      const SR = (window as VentanaConVoz).SpeechRecognition || (window as VentanaConVoz).webkitSpeechRecognition;
      if (SR) {
        const r = new SR();
        r.lang = "es-MX";
        r.interimResults = true;
        r.continuous = true;
        r.onresult = (e) => {
          let final = "";
          let parcial = "";
          for (let i = 0; i < e.results.length; i++) {
            const texto = e.results[i][0]?.transcript ?? "";
            if (e.results[i].isFinal) final += `${texto} `;
            else parcial += texto;
          }
          if (final) textoFinalRef.current = `${textoFinalRef.current} ${final}`.trim();
          setTranscripcionParcial(`${textoFinalRef.current} ${parcial}`.trim());
        };
        r.onerror = () => {
          // Si el reconocimiento falla (ej. se corto por silencio
          // largo), la grabacion del audio sigue de todas formas --
          // nada mas no se reinicia la transcripcion.
        };
        recoRef.current = r;
        try {
          r.start();
        } catch {
          // Si ya estaba corriendo otro, no pasa nada -- se sigue
          // grabando el audio igual.
        }
      }

      setGrabando(true);
    } catch {
      detenerTodo();
    }
  }

  function detenerTodo() {
    if (animacionRef.current) cancelAnimationFrame(animacionRef.current);
    animacionRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setNivelAudio(0);
    setGrabando(false);
  }

  function detenerYMandar() {
    if (!grabando) return;
    try {
      recoRef.current?.stop();
    } catch {
      // nada
    }
    recoRef.current = null;
    grabadoraRef.current?.stop();
    grabadoraRef.current = null;
    detenerTodo();
  }

  function cancelar() {
    if (!grabando) return;
    try {
      recoRef.current?.stop();
    } catch {
      // nada
    }
    recoRef.current = null;
    if (grabadoraRef.current) {
      // Al cancelar no se quiere mandar nada -- se desactiva el
      // "onstop" antes de detener, para que no dispare alTerminar.
      grabadoraRef.current.onstop = null;
      grabadoraRef.current.stop();
    }
    grabadoraRef.current = null;
    detenerTodo();
  }

  return { soportado, grabando, transcripcionParcial, nivelAudio, iniciar, detenerYMandar, cancelar };
}

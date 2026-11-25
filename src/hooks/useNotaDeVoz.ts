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
  onend: (() => void) | null;
  onstart: (() => void) | null;
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
  // Igual que textoFinalRef, pero con lo ultimo que se va oyendo (sin
  // terminar de confirmar todavia) -- se usa como respaldo si nunca
  // llego a marcarse nada como "final" antes de que se le diera a
  // mandar (ver el "onstop" de abajo). Tiene que ser un ref, NO nomas
  // el estado "transcripcionParcial": el "onstop" se define una sola
  // vez, al EMPEZAR a grabar, asi que si leyera el estado de React en
  // vez de un ref, siempre veria el valor viejo (vacio) de cuando
  // empezo a grabar, nunca lo que se fue diciendo despues -- eso hacia
  // que notas de voz cortas se mandaran sin texto y el bot contestara
  // como si no hubiera entendido nada, aunque escribiendo lo mismo si
  // funcionaba bien (lo reporto Vic).
  const transcripcionParcialRef = useRef("");
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
    transcripcionParcialRef.current = "";
    setTranscripcionParcial("");

    // En varios celulares Android, el reconocimiento de voz (que agarra
    // el microfono por su cuenta, aparte del "stream" que usa
    // MediaRecorder para grabar) se queda sin poder escuchar NADA si el
    // microfono ya estaba ocupado grabando el audio cuando el intenta
    // entrar -- el celular solo deja un "consumidor" de audio a la vez,
    // y gana el que haya pedido el microfono primero. Antes aqui se
    // pedia el microfono PRIMERO para grabar (getUserMedia +
    // MediaRecorder) y nada mas despues se prendia el reconocimiento de
    // voz -- eso dejaba al reconocimiento sin poder escuchar nunca nada
    // en esos celulares (Vic lo confirmo: ni una palabra se transcribia,
    // ni la rayitas de "escuchando en vivo" se movian). Ahora se prende
    // PRIMERO el reconocimiento de voz, y se le da un instante (su
    // propio aviso "onstart", o como mucho 400ms) para que agarre el
    // microfono el primero, y ya despues se empieza a grabar el audio.
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
        const parcialCompleta = `${textoFinalRef.current} ${parcial}`.trim();
        transcripcionParcialRef.current = parcialCompleta;
        setTranscripcionParcial(parcialCompleta);
      };
      r.onerror = () => {
        // Si el reconocimiento falla (ej. se corto por silencio
        // largo), la grabacion del audio sigue de todas formas --
        // nada mas no se reinicia la transcripcion.
      };
      recoRef.current = r;
      try {
        r.start();
        await new Promise<void>((resolve) => {
          let resuelto = false;
          const terminarEspera = () => {
            if (resuelto) return;
            resuelto = true;
            resolve();
          };
          r.onstart = terminarEspera;
          setTimeout(terminarEspera, 400);
        });
      } catch {
        // Si ya estaba corriendo otro, no pasa nada -- se sigue
        // grabando el audio igual, nada mas sin transcripcion.
        recoRef.current = null;
      }
    }

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
        const texto = textoFinalRef.current.trim() || transcripcionParcialRef.current.trim();
        alTerminar({ blobUrl, texto });
      };
      grabadoraRef.current = grabadora;
      grabadora.start();

      setGrabando(true);
    } catch {
      try {
        recoRef.current?.stop();
      } catch {
        // nada
      }
      recoRef.current = null;
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

  // El problema de fondo que seguia hacienda que el bot "no entendiera"
  // el audio (reportado por Vic incluso despues de arreglar el cierre
  // de transcripcionParcial): al decirle "stop" al reconocimiento de
  // voz, este NO termina de inmediato -- sigue un instante mas
  // procesando el ultimo pedacito de lo que se dijo, y VARIOS
  // reconocedores (sobre todo si la persona hablo de corrido, sin
  // pausas) nada mas mandan su unico resultado "final" justo en ese
  // momento, DESPUES de llamar stop(), nunca antes. Como aqui se
  // paraba la grabadora de audio (y se mandaba el mensaje) AL MISMO
  // TIEMPO que se le decia stop() al reconocimiento, la nota de voz se
  // mandaba ANTES de que ese resultado final llegara -- el bot recibia
  // el mensaje practicamente sin texto transcrito, como si no hubiera
  // entendido nada, sin importar que tan claro se hablara. Por eso
  // ahora se espera a que el reconocimiento avise que de verdad termino
  // ("onend", o "onerror" si fallo) -- o como mucho 1.2 segundos, por
  // si el navegador nunca avisa -- antes de parar la grabadora y mandar
  // la nota de voz.
  function detenerYMandar() {
    if (!grabando) return;
    const reco = recoRef.current;
    recoRef.current = null;

    const finalizarGrabacion = () => {
      grabadoraRef.current?.stop();
      grabadoraRef.current = null;
      detenerTodo();
    };

    if (!reco) {
      finalizarGrabacion();
      return;
    }

    let yaSiguio = false;
    const seguir = () => {
      if (yaSiguio) return;
      yaSiguio = true;
      finalizarGrabacion();
    };
    reco.onend = seguir;
    reco.onerror = seguir;
    setTimeout(seguir, 1200);
    try {
      reco.stop();
    } catch {
      seguir();
    }
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

"use client";

import { useRef, useState } from "react";

// Dicta por voz usando la funcion del propio navegador (Web Speech API /
// SpeechRecognition) -- sin ningun servicio externo ni costo. El navegador
// escucha el microfono, lo convierte a texto el mismo, y nos entrega el
// texto final cuando la persona termina de hablar.
//
// Limites (son del navegador, no de este codigo):
// - Solo funciona en Chrome y Edge. En Firefox no existe, y en Safari de
//   iPhone es poco confiable.
// - Necesita HTTPS (Vercel ya lo da) y que la persona le de permiso al
//   microfono la primera vez.
export function useDictado(alTerminar: (texto: string) => void) {
  const [escuchando, setEscuchando] = useState(false);
  const reco = useRef<any>(null);

  const soportado =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const iniciar = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "es-MX";
    r.interimResults = false;
    r.continuous = false;
    let texto = "";
    r.onresult = (e: any) => {
      texto = e.results?.[0]?.[0]?.transcript || "";
    };
    r.onerror = () => setEscuchando(false);
    r.onend = () => {
      setEscuchando(false);
      if (texto.trim()) alTerminar(texto.trim());
    };
    reco.current = r;
    setEscuchando(true);
    r.start();
  };

  const detener = () => {
    try {
      reco.current?.stop();
    } catch {
      // nada
    }
  };

  return { soportado, escuchando, iniciar, detener };
}

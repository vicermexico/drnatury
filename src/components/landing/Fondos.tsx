"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";

export interface Fondo {
  id: string;
  tipo: "imagen" | "video";
  url: string;
}

const SEGUNDOS_POR_FOTO = 7;
const MAX_VIDEO_MS = 30000;

// Fondo de la portada: si hay varias fotos van cambiando solas (con fundido
// entre una y otra); un video avanza al siguiente fondo cuando termina (o a
// los 30s como respaldo). Igual al patron de appvlc, adaptado a DrNatury.
export function Fondos({ fondos }: { fondos: Fondo[] }) {
  const [actual, setActual] = useState(0);
  const total = fondos.length;
  const item = fondos[actual % Math.max(total, 1)];

  useEffect(() => {
    if (total < 2 || !item) return;
    const espera = item.tipo === "video" ? MAX_VIDEO_MS : SEGUNDOS_POR_FOTO * 1000;
    const t = setTimeout(() => setActual((previo) => (previo + 1) % total), espera);
    return () => clearTimeout(t);
  }, [actual, item, total]);

  if (total === 0) return null;

  return (
    <div className="absolute inset-0" aria-hidden="true">
      {fondos.map((f, n) =>
        f.tipo === "imagen" ? (
          <img
            key={f.id}
            src={f.url}
            alt=""
            loading={n === 0 ? "eager" : "lazy"}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ${
              n === actual % total ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : n === actual % total ? (
          <video
            key={f.id}
            src={f.url}
            autoPlay
            muted
            playsInline
            loop={total === 1}
            onEnded={() => setActual((previo) => (previo + 1) % total)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null
      )}
    </div>
  );
}

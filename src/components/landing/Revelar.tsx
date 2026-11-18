"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

// Muestra su contenido con un fundido y un pequeño desplazamiento la primera
// vez que la persona baja hasta el (IntersectionObserver). Los estilos estan
// en globals.css (.revelar). Replica el patron usado en appvlc.
export function Revelar({
  children,
  retraso = 0,
  className = "",
}: {
  children: ReactNode;
  retraso?: number;
  className?: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [visto, setVisto] = useState(false);

  useEffect(() => {
    const elemento = caja.current;
    if (!elemento) return;
    if (!("IntersectionObserver" in window)) {
      const t = setTimeout(() => setVisto(true), 0);
      return () => clearTimeout(t);
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisto(true);
          observador.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={caja}
      style={{ "--retraso": `${retraso}ms` } as CSSProperties}
      className={`revelar ${visto ? "visto" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

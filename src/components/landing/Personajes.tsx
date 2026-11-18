"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface Personaje {
  id: string;
  nombre: string | null;
  puesto: string | null;
  url: string;
}

// Entran uno a la vez: el primero por la izquierda, el segundo por la
// derecha, y asi -- su nombre y puesto se animan hacia el centro y luego se
// acomodan a un lado. El ultimo se queda fijo. Version simplificada de la de
// appvlc (sin recorte automatico del fondo de la foto).

const INICIO_PERSONAJE = 1000;
const RETRASO_PUESTO = 1700;
const RETRASO_NOMBRE = 3100;
const DURACION_ROTULO = 2600;
const SE_QUEDA = 9500;
const TARDA_EN_SALIR = 900;

function Rotulo({
  lado,
  retraso,
  className,
  children,
}: {
  lado: "izq" | "der";
  retraso: number;
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let animacion: Animation | undefined;
    const reloj = setTimeout(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        animacion = el.animate(
          [
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 1600, easing: "ease-out", fill: "both" }
        );
        return;
      }
      const r = el.getBoundingClientRect();
      const ancho = window.innerWidth;
      let grande = ancho >= 1024 ? 2 : 1.5;
      let centroX = ancho / 2;
      const foto = document.querySelector("[data-personaje-foto]")?.getBoundingClientRect();
      if (foto && ancho < 1024) {
        const libreIzq = lado === "izq" ? foto.right + 8 : 8;
        const libreDer = lado === "izq" ? ancho - 8 : foto.left - 8;
        const libre = Math.max(40, libreDer - libreIzq);
        centroX = (libreIzq + libreDer) / 2;
        grande = Math.max(1, Math.min(grande, libre / r.width));
      }
      const aCentroX = centroX - (r.left + r.width / 2);
      let destinoY = window.innerHeight * 0.5;
      const portada = el.closest("section")?.getBoundingClientRect();
      if (portada) {
        const medio = (r.height * grande) / 2 + 12;
        const arriba = Math.max(portada.top, 0) + medio;
        const abajo = portada.bottom - medio;
        destinoY = abajo >= arriba ? Math.min(Math.max(destinoY, arriba), abajo) : (portada.top + portada.bottom) / 2;
      }
      const aCentroY = destinoY - (r.top + r.height / 2);
      const mitad = (r.width * grande) / 2 + 24;
      const vieneDeIzquierda = ancho < 1024 ? lado === "der" : lado === "izq";
      const desdeX = (vieneDeIzquierda ? -mitad : ancho + mitad) - (r.left + r.width / 2);
      const grandeEnCentro = `translate(${aCentroX}px, ${aCentroY}px) scale(${grande})`;
      animacion = el.animate(
        [
          {
            opacity: 0,
            transform: `translate(${desdeX}px, ${aCentroY}px) scale(${grande})`,
            offset: 0,
            easing: "cubic-bezier(0.35, 0.1, 0.25, 1)",
          },
          { opacity: 1, offset: 0.12 },
          { opacity: 1, transform: grandeEnCentro, offset: 0.4 },
          { opacity: 1, transform: grandeEnCentro, offset: 0.56, easing: "cubic-bezier(0.45, 0, 0.2, 1)" },
          { opacity: 1, transform: "none", offset: 1 },
        ],
        { duration: DURACION_ROTULO, fill: "both" }
      );
    }, retraso);
    return () => {
      clearTimeout(reloj);
      animacion?.cancel();
    };
  }, [lado, retraso]);

  return (
    <p ref={ref} style={{ opacity: 0 }} className={`${className} [overflow-wrap:anywhere]`}>
      {children}
    </p>
  );
}

function FotoPersonaje({ personaje, lado }: { personaje: Personaje; lado: "izq" | "der" }) {
  return (
    <img
      src={personaje.url}
      alt={personaje.nombre ?? ""}
      data-personaje-foto
      className={`personaje-${lado} h-[min(46dvh,calc(max(85dvh,28rem)_-_15rem))] w-auto max-w-[52vw] object-contain object-bottom lg:h-[72dvh] lg:max-w-[30vw]`}
    />
  );
}

export function Personajes({ personajes }: { personajes: Personaje[] }) {
  const total = personajes.length;
  const [indice, setIndice] = useState(-1);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    if (total === 0) return;
    const relojes: ReturnType<typeof setTimeout>[] = [];

    function mostrar(i: number) {
      setIndice(i);
      setSaliendo(false);
      if (i < total - 1) {
        relojes.push(
          setTimeout(() => {
            setSaliendo(true);
            relojes.push(setTimeout(() => mostrar(i + 1), TARDA_EN_SALIR));
          }, SE_QUEDA)
        );
      }
    }

    relojes.push(setTimeout(() => mostrar(0), INICIO_PERSONAJE));
    return () => relojes.forEach(clearTimeout);
  }, [total]);

  const personaje = personajes[indice];
  if (!personaje) return null;
  const izquierda = indice % 2 === 0;
  const lado = izquierda ? "izq" : "der";

  return (
    <div
      key={personaje.id}
      className={`pointer-events-none absolute inset-0 z-10 [clip-path:inset(0_0_-6rem_0)] ${saliendo ? `grupo-sale-${lado}` : ""}`}
    >
      <div
        className={`absolute -bottom-9 flex items-end gap-3 lg:-bottom-14 lg:gap-8 ${
          izquierda ? "left-3 flex-row lg:left-[8%]" : "right-3 flex-row-reverse lg:right-[8%]"
        }`}
      >
        <FotoPersonaje personaje={personaje} lado={lado} />
        {(personaje.nombre || personaje.puesto) && (
          <div
            className={`flex min-w-0 max-w-[42vw] flex-col gap-1.5 pb-[16dvh] lg:max-w-[26vw] lg:gap-3 lg:pb-[38dvh] ${
              izquierda ? "items-start text-left" : "items-end text-right"
            }`}
          >
            {personaje.nombre && (
              <Rotulo
                lado={lado}
                retraso={RETRASO_NOMBRE}
                className="text-xl font-bold uppercase leading-tight tracking-[0.1em] text-white [text-shadow:0_2px_10px_rgba(6,78,59,0.9)] lg:text-4xl"
              >
                {personaje.nombre}
              </Rotulo>
            )}
            {personaje.puesto && (
              <Rotulo
                lado={lado}
                retraso={RETRASO_PUESTO}
                className="text-[10px] font-semibold uppercase leading-snug tracking-[0.25em] text-white/90 [text-shadow:0_2px_8px_rgba(6,78,59,0.9)] lg:text-sm lg:tracking-[0.3em]"
              >
                {personaje.puesto}
              </Rotulo>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Revelar } from "./Revelar";
import { Titulo } from "./Titulo";

export interface ServicioCarrusel {
  id: string;
  title: string;
  description: string;
  image_url: string;
}

const SEGUNDOS_POR_SERVICIO = 4.5;

function Tarjeta({ servicio, activo }: { servicio: ServicioCarrusel; activo: boolean }) {
  const base = `absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 transition-opacity duration-700 ${
    activo ? "opacity-100" : "pointer-events-none opacity-0"
  }`;
  return (
    <Link
      href={`/inicio/servicio/${servicio.id}`}
      tabIndex={activo ? 0 : -1}
      aria-hidden={!activo}
      aria-label={`${servicio.title} (ver detalle)`}
      className={`${base} group`}
    >
      {servicio.image_url && (
        <img src={servicio.image_url} alt={servicio.title} loading="lazy" draggable={false} className="max-h-32 w-auto max-w-full object-contain sm:max-h-44 rounded-xl" />
      )}
      <p className="text-center text-base font-semibold text-emerald-950 group-hover:underline">{servicio.title}</p>
      {servicio.description && (
        <p className="text-center text-sm text-emerald-900/70 max-w-sm line-clamp-2">{servicio.description}</p>
      )}
    </Link>
  );
}

// "Nuestros servicios": uno a la vez, con fundido entre uno y otro, en bucle. Replica
// del estilo de carrusel "Nuestros clientes" de appvlc, reusando los servicios ya
// capturados en el panel de Master (landing_services).
export function Servicios({ services }: { services: ServicioCarrusel[] }) {
  const [actual, setActual] = useState(0);
  const total = services.length;
  const indice = total > 0 ? actual % total : 0;
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (total < 2) return;
    reloj.current = setTimeout(() => setActual((previo) => (previo + 1) % total), SEGUNDOS_POR_SERVICIO * 1000);
    return () => {
      if (reloj.current) clearTimeout(reloj.current);
    };
  }, [actual, total]);

  if (total === 0) return null;

  return (
    <section className="bg-white px-6 py-16 sm:py-20" aria-label="Nuestros servicios">
      <div className="mx-auto max-w-3xl">
        <Titulo>Nuestros servicios</Titulo>
        <Revelar>
          <div className="relative mx-auto h-56 w-full max-w-md sm:h-72">
            {services.map((s, n) => (
              <Tarjeta key={s.id} servicio={s} activo={n === indice} />
            ))}
          </div>
          {total > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              {services.map((s, n) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActual(n)}
                  aria-label={`Ver ${s.title}`}
                  aria-current={n === indice}
                  className={`h-2.5 rounded-full transition-all ${
                    n === indice ? "w-6 bg-emerald-800" : "w-2.5 bg-emerald-800/25 hover:bg-emerald-800/50"
                  }`}
                />
              ))}
            </div>
          )}
        </Revelar>
      </div>
    </section>
  );
}

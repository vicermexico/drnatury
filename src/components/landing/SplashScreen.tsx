"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
const LEAF_SVGS = [
  `<svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C7 4 3 9 3 14c0 4 3.5 7 9 8 5.5-1 9-4 9-8 0-5-4-10-9-12Z" fill="#2f6b3a" fill-opacity="0.85"/>
    <path d="M12 2v20" stroke="#1b4f72" stroke-width="0.6" stroke-opacity="0.5"/>
  </svg>`,
  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C7 4 3 9 3 14c0 4 3.5 7 9 8 5.5-1 9-4 9-8 0-5-4-10-9-12Z" fill="#1b4f72" fill-opacity="0.8"/>
    <path d="M12 2v20" stroke="#2f6b3a" stroke-width="0.6" stroke-opacity="0.5"/>
  </svg>`,
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C7 4 3 9 3 14c0 4 3.5 7 9 8 5.5-1 9-4 9-8 0-5-4-10-9-12Z" fill="#4d8a4f" fill-opacity="0.75"/>
  </svg>`,
];
type Leaf = {
  left: number;
  duration: number;
  delay: number;
  drift: number;
  spin: number;
  scale: number;
  svg: string;
};
function FallingLeaves() {
  const [leaves, setLeaves] = useState<Leaf[]>([]);
  useEffect(() => {
    const generated: Leaf[] = Array.from({ length: 20 }, () => ({
      left: Math.random() * 100,
      duration: 9 + Math.random() * 8,
      delay: Math.random() * 6,
      drift: Math.random() * 160 - 80,
      spin: 300 + Math.random() * 300,
      scale: 0.7 + Math.random() * 0.9,
      svg: LEAF_SVGS[Math.floor(Math.random() * LEAF_SVGS.length)],
    }));
    setLeaves(generated);
  }, []);
  return (
    <>
      <style jsx>{`
        .leaf {
          position: absolute;
          top: -8%;
          will-change: transform, opacity;
          animation-name: fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          opacity: 0;
        }
        @keyframes fall {
          0% {
            transform: translate(0, 0) rotate(0deg);
            opacity: 0;
          }
          8% {
            opacity: 0.9;
          }
          92% {
            opacity: 0.85;
          }
          100% {
            transform: translate(var(--drift, 40px), 118vh) rotate(var(--spin, 340deg));
            opacity: 0;
          }
        }
      `}</style>
      {leaves.map((leaf, i) => (
        <div
          key={i}
          className="leaf"
          style={
            {
              left: `${leaf.left}vw`,
              "--drift": `${leaf.drift}px`,
              "--spin": `${leaf.spin}deg`,
              transform: `scale(${leaf.scale})`,
              animationDuration: `${leaf.duration}s`,
              animationDelay: `${leaf.delay}s`,
            } as React.CSSProperties
          }
          dangerouslySetInnerHTML={{ __html: leaf.svg }}
        />
      ))}
    </>
  );
}
interface SplashScreenProps {
  onFinish: () => void;
  logoUrl?: string | null;
  nombreUrl?: string | null;
  mostrarLogo?: boolean;
  mostrarNombre?: boolean;
}

export function SplashScreen({
  onFinish,
  logoUrl,
  nombreUrl,
  mostrarLogo = true,
  mostrarNombre = true,
}: SplashScreenProps) {
  // Si Master desactivo alguna de las 2 imagenes, nos saltamos
  // directo a la que si esta activa (o directo a "entrar" si
  // desactivo las dos, aunque eso no deberia pasar normalmente).
  const faseInicial = mostrarLogo ? "emblema" : mostrarNombre ? "nombre" : "enter";
  const [phase, setPhase] = useState<"emblema" | "nombre" | "enter">(faseInicial);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (mostrarLogo && mostrarNombre) {
      timers.push(setTimeout(() => setPhase("nombre"), 1000));
      timers.push(setTimeout(() => setPhase("enter"), 2500));
    } else if (mostrarLogo || mostrarNombre) {
      timers.push(setTimeout(() => setPhase("enter"), 1500));
    }
    return () => timers.forEach(clearTimeout);
  }, [mostrarLogo, mostrarNombre]);
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center overflow-hidden">
      <FallingLeaves />
      {mostrarLogo && (
        <div
          style={{
            opacity: phase === "emblema" ? 1 : 0,
            transform: phase === "emblema" ? "translateY(0)" : "translateY(-20px)",
            transition: "all 0.6s ease",
            position: "absolute",
            zIndex: 1,
          }}
        >
          <Image src={logoUrl || "/logo.jpg"} alt="Emblema DrNatury" width={300} height={225} unoptimized className="object-contain" priority />
        </div>
      )}
      {mostrarNombre && (
        <div
          style={{
            opacity: phase === "nombre" || phase === "enter" ? 1 : 0,
            transform: phase === "nombre" || phase === "enter" ? "scale(1)" : "scale(0.8)",
            transition: "all 0.8s ease",
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
            zIndex: 1,
          }}
        >
          <Image
            src={nombreUrl || "/drnatury-logo-full.png"}
            alt="DrNatury - Bienestar integral y natural"
            width={340}
            height={170}
            unoptimized
            className="object-contain"
            priority
          />
          {phase === "enter" && (
            <button
              onClick={onFinish}
              className="bg-emerald-400 text-white text-lg font-bold px-12 py-4 rounded-2xl shadow-lg hover:bg-emerald-500 transition animate-pulse"
            >
              Entrar
            </button>
          )}
        </div>
      )}
      {!mostrarNombre && phase === "enter" && (
        <button
          onClick={onFinish}
          className="absolute z-[2] bg-emerald-400 text-white text-lg font-bold px-12 py-4 rounded-2xl shadow-lg hover:bg-emerald-500 transition animate-pulse"
          style={{ bottom: "20%" }}
        >
          Entrar
        </button>
      )}
    </div>
  );
}

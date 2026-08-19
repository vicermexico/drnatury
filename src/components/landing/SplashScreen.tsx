"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [phase, setPhase] = useState<"doctor" | "logo" | "enter">("doctor");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("logo"), 1000);
    const t2 = setTimeout(() => setPhase("enter"), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center">
      <div style={{ opacity: phase === "doctor" ? 1 : 0, transform: phase === "doctor" ? "translateY(0)" : "translateY(-20px)", transition: "all 0.6s ease", position: "absolute" }}>
        <Image src="/logo.jpg" alt="Doctor" width={280} height={280} className="object-contain" priority />
      </div>
      <div style={{ opacity: phase === "logo" || phase === "enter" ? 1 : 0, transform: phase === "logo" || phase === "enter" ? "scale(1)" : "scale(0.8)", transition: "all 0.8s ease", position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", gap: "32px" }}>
        <Image src="/nombre.jpg" alt="Dr. BioEscaner" width={300} height={120} className="object-contain" priority />
        {phase === "enter" && (
          <button
            onClick={onFinish}
            className="bg-blue-600 text-white text-lg font-bold px-12 py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition animate-pulse"
          >
            Entrar
          </button>
        )}
      </div>
    </div>
  );
}

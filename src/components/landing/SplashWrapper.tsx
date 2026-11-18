"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SplashScreen } from "./SplashScreen";

interface Props {
  logoUrl?: string | null;
  nombreUrl?: string | null;
  mostrarLogo?: boolean;
  mostrarNombre?: boolean;
}

export function SplashWrapper({ logoUrl, nombreUrl, mostrarLogo, mostrarNombre }: Props) {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  function handleFinish() {
    setShowSplash(false);
    router.push("/inicio");
  }

  if (!showSplash) return null;

  return (
    <SplashScreen
      onFinish={handleFinish}
      logoUrl={logoUrl}
      nombreUrl={nombreUrl}
      mostrarLogo={mostrarLogo}
      mostrarNombre={mostrarNombre}
    />
  );
}

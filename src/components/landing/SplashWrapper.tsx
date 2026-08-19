"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SplashScreen } from "./SplashScreen";

export function SplashWrapper() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  function handleFinish() {
    setShowSplash(false);
    router.push("/inicio");
  }

  if (!showSplash) return null;

  return <SplashScreen onFinish={handleFinish} />;
}

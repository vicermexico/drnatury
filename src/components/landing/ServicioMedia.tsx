"use client";

import { useState } from "react";

interface Servicio {
  title: string;
  description: string;
  image_url: string;
  detail_media_url: string;
  detail_media_type: string;
}

export function ServicioMedia({ servicio }: { servicio: Servicio }) {
  const [videoEnded, setVideoEnded] = useState(false);

  if (servicio.detail_media_type === "video" && servicio.detail_media_url && !videoEnded) {
    return (
      <video
        src={servicio.detail_media_url}
        className="w-full h-72 object-cover"
        autoPlay
        playsInline
        onEnded={() => setVideoEnded(true)}
      />
    );
  }

  const fallbackImg = servicio.image_url || servicio.detail_media_url;
  if (fallbackImg) {
    return <img src={fallbackImg} alt={servicio.title} className="w-full h-72 object-cover" />;
  }

  return null;
}

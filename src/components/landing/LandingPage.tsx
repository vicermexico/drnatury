"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Fondos, type Fondo } from "./Fondos";
import { Personajes, type Personaje } from "./Personajes";
import { Servicios } from "./Servicios";
import { Contactos } from "./Contactos";
import { RedesYPie } from "./RedesYPie";
interface Config {
  whatsapp_number: string;
  hero_title: string;
  hero_subtitle: string;
  splash_gif_url: string;
  hero_video_url: string;
  hero_type: string;
  hero_video_loop: boolean;
  hero_video_logo: boolean;
  contacto_correo?: string | null;
  contacto_sitio_web?: string | null;
  contacto_direccion?: string | null;
  contacto_horario?: string | null;
  red_facebook?: string | null;
  red_instagram?: string | null;
  dev_nombre?: string | null;
  dev_whatsapp?: string | null;
}
interface Service {
  id: string;
  title: string;
  description: string;
  image_url: string;
}
interface Props {
  config: Config;
  services: Service[];
  fondos?: Fondo[];
  personajes?: Personaje[];
}
export function LandingPage({ config, services, fondos = [], personajes = [] }: Props) {
  const waLink = `https://api.whatsapp.com/send?phone=${config?.whatsapp_number}&text=Hola%21%20Quisiera%20mas%20informacion.`;
  const heroType = config?.hero_type ?? "image";
  const heroImg = config?.splash_gif_url || "/nombre.jpg";
  const heroVideo = config?.hero_video_url || "";
  const heroVideoLoop = config?.hero_video_loop ?? false;
  const heroVideoLogo = config?.hero_video_logo ?? false;
  const [videoEnded, setVideoEnded] = useState(false);
  const [logoVisible, setLogoVisible] = useState(false);
  const [barraVisible, setBarraVisible] = useState(false);
  const showingVideo = heroType === "video" && heroVideo && !videoEnded;
  useEffect(() => {
    if (showingVideo && heroVideoLogo) {
      const t = setTimeout(() => setLogoVisible(true), 300);
      return () => clearTimeout(t);
    }
    setLogoVisible(false);
  }, [showingVideo, heroVideoLogo]);
  useEffect(() => {
    const t = setTimeout(() => setBarraVisible(true), 150);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="min-h-screen bg-white">
      <div className="relative w-full h-screen overflow-x-clip">
        {/* El recorte del fondo va en su propia caja; la seccion no recorta hacia
            abajo para que el personaje se asome (igual que en appvlc). */}
        <div className="absolute inset-0 overflow-hidden">
          {fondos.length > 0 ? (
            <Fondos fondos={fondos} />
          ) : showingVideo ? (
            <video
              src={heroVideo}
              autoPlay
              playsInline
              loop={heroVideoLoop}
              onEnded={() => { if (!heroVideoLoop) setVideoEnded(true); }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <Image src={heroImg || "/nombre.jpg"} alt="DrNatury" fill className="object-cover" unoptimized priority />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/55 via-emerald-950/25 to-emerald-950/70" aria-hidden="true" />
        </div>
        <Personajes personajes={personajes} />
        {showingVideo && heroVideoLogo && (
          <div className="absolute inset-x-0 top-[32%] flex justify-center pointer-events-none">
            <Image
              src="/logo-transparente.png"
              alt="DrNatury"
              width={320}
              height={240}
              unoptimized
              className={`drop-shadow-2xl w-56 sm:w-72 h-auto transition-all duration-1000 ease-out ${
                logoVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
              }`}
            />
          </div>
        )}

        {/* Nombre de la marca */}
        <div className="absolute left-1/2 top-[12rem] z-20 -translate-x-1/2 lg:bottom-[5dvh] lg:top-auto">
          <h1 className="text-center text-2xl font-extrabold tracking-wide text-white [text-shadow:0_2px_12px_rgba(6,78,59,0.9)] lg:text-4xl">
            DrNatury
          </h1>
        </div>

        {/* Barra fija arriba a la derecha, con los dos botones */}
        <div
          className={`fixed inset-x-3 top-3 z-30 transition-opacity duration-1000 sm:inset-x-auto sm:right-5 sm:top-5 sm:w-80 ${
            barraVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="w-full overflow-hidden rounded-2xl border-2 border-amber-400 bg-white shadow-2xl ring-4 ring-white/30">
            <h2 className="bg-emerald-900 px-4 py-2 text-sm font-bold tracking-wide text-white sm:text-base">
              DrNatury
            </h2>
            <div className="flex flex-col gap-2 p-3">
              <Link
                href="/chat?origen=inicio"
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-bold text-white text-center
                           bg-gradient-to-r from-blue-600 via-emerald-500 to-green-600
                           shadow transition-all duration-300 hover:shadow-md"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0">
                  <path d="M12 3C9 8 4 9 4 14c0 4 4 6 8 7 4-1 8-3 8-7 0-5-5-6-8-11Z" fill="currentColor" fillOpacity="0.15" />
                  <path d="M12 21V10M12 10c0-3 2-5 5-6M12 10C11 7 9 6 6 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Agenda tu cita
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-emerald-900 text-center
                           border border-emerald-900/20 bg-white
                           transition-all duration-300 hover:bg-emerald-50"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Servicios services={services} />
      <Contactos config={config} />
      <RedesYPie config={config} />
      {config?.whatsapp_number && (
        <a href={waLink} target="_blank" rel="noopener noreferrer" className="fixed bottom-6 right-6 bg-green-500 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition z-50">
          <svg viewBox="0 0 24 24" fill="white" width="32" height="32">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      )}
    </div>
  );
}

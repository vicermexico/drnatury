"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
interface Config {
  whatsapp_number: string;
  hero_title: string;
  hero_subtitle: string;
  splash_gif_url: string;
  hero_video_url: string;
  hero_type: string;
  hero_video_loop: boolean;
  hero_video_logo: boolean;
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
}
export function LandingPage({ config, services }: Props) {
  const waLink = `https://api.whatsapp.com/send?phone=${config?.whatsapp_number}&text=Hola%21%20Quisiera%20mas%20informacion.`;
  const heroType = config?.hero_type ?? "image";
  const heroImg = config?.splash_gif_url || "/nombre.jpg";
  const heroVideo = config?.hero_video_url || "";
  const heroVideoLoop = config?.hero_video_loop ?? false;
  const heroVideoLogo = config?.hero_video_logo ?? false;
  const [videoEnded, setVideoEnded] = useState(false);
  const [logoVisible, setLogoVisible] = useState(false);
  const showingVideo = heroType === "video" && heroVideo && !videoEnded;
  useEffect(() => {
    if (showingVideo && heroVideoLogo) {
      const t = setTimeout(() => setLogoVisible(true), 300);
      return () => clearTimeout(t);
    }
    setLogoVisible(false);
  }, [showingVideo, heroVideoLogo]);
  return (
    <div className="min-h-screen bg-white">
      <div className="relative w-full h-screen flex flex-col items-center justify-end pb-32">
        {showingVideo ? (
          <video
            src={heroVideo}
            autoPlay
            playsInline
            loop={heroVideoLoop}
            onEnded={() => { if (!heroVideoLoop) setVideoEnded(true); }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <Image src={heroImg || "/nombre.jpg"} alt="Dr. BioEscaner" fill className="object-cover" unoptimized priority />
        )}
        <div className="absolute inset-0 bg-black/30" />
        {showingVideo && heroVideoLogo && (
          <div className="absolute inset-x-0 top-[8%] flex justify-center pointer-events-none">
            <Image
              src="/logo-transparente.png"
              alt="DrNatury"
              width={220}
              height={165}
              unoptimized
              className={`drop-shadow-2xl w-36 sm:w-48 h-auto transition-all duration-1000 ease-out ${
                logoVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
              }`}
            />
          </div>
        )}
        <div className="relative z-10 flex flex-col items-center gap-4 w-full px-8 mb-16">
          <Link
            href="/registro"
            className="group relative inline-flex items-center justify-center gap-2 w-full max-w-sm px-10 py-5 rounded-full text-xl font-bold text-white text-center
                       bg-gradient-to-r from-blue-600 via-emerald-500 to-green-600 bg-[length:200%_auto]
                       shadow-[0_8px_30px_rgba(16,185,129,0.35)]
                       transition-all duration-500 hover:bg-[position:100%_0] hover:shadow-[0_10px_40px_rgba(16,185,129,0.5)] hover:-translate-y-0.5"
          >
            <span className="absolute -inset-1 rounded-full bg-emerald-400/30 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0">
              <path d="M12 3C9 8 4 9 4 14c0 4 4 6 8 7 4-1 8-3 8-7 0-5-5-6-8-11Z" fill="currentColor" fillOpacity="0.15" />
              <path d="M12 21V10M12 10c0-3 2-5 5-6M12 10C11 7 9 6 6 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Regístrate
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full max-w-sm px-8 py-3.5 rounded-full text-base font-semibold text-white text-center
                       border border-white/70 bg-white/10 backdrop-blur-sm
                       transition-all duration-300 hover:bg-white/20 hover:border-white"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
      {services.length > 0 && (
        <div className="px-6 py-12 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Nuestros servicios</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {services.map((s) => (
              <Link key={s.id} href={`/inicio/servicio/${s.id}`} className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm hover:shadow-md transition block">
                {s.image_url && <img src={s.image_url} alt={s.title} className="w-full h-36 object-cover" />}
                <div className="p-3">
                  <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
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

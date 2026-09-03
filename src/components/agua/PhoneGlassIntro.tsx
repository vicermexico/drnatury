import Image from "next/image";

export function PhoneGlassIntro() {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center relative">
      <style>{`
        @keyframes waterScreenGlowOuter {
          0%, 100% { opacity: 0.35; transform: scale(0.92); }
          50%      { opacity: 1;    transform: scale(1.08); }
        }
        @keyframes waterScreenGlowCore {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50%      { opacity: 1;    transform: scale(1.1); }
        }
        @keyframes glassFloat {
          0%, 100% { transform: translate(-50%, 0); }
          50%      { transform: translate(-50%, -7px); }
        }
        .water-screen-glow-outer { animation: waterScreenGlowOuter 2.4s ease-in-out infinite; }
        .water-screen-glow-core  { animation: waterScreenGlowCore  2.4s ease-in-out infinite; }
        .water-glass-float { animation: glassFloat 3s ease-in-out infinite; }
      `}</style>
      <div className="relative flex flex-col items-center w-64 sm:w-72">
        {/* Celular acostado */}
        <div className="relative w-full">
          <Image
            src="/agua-celular.png"
            alt=""
            width={1568}
            height={453}
            unoptimized
            className="w-full h-auto"
          />
          {/* Luz de la pantalla: brillo suave exterior + nucleo brillante */}
          <div className="water-screen-glow-outer absolute left-[5%] right-[7%] top-[6%] bottom-[34%] rounded-2xl bg-cyan-300/70 blur-xl" />
          <div className="water-screen-glow-core absolute left-[22%] right-[24%] top-[14%] bottom-[42%] rounded-full bg-cyan-50/90 blur-md" />
          {/* Vaso de agua centrado sobre el celular, bajando hasta la mitad de la pantalla */}
          <div
            className="water-glass-float absolute z-10 left-1/2 w-20 sm:w-24"
            style={{ bottom: "64%" }}
          >
            <Image
              src="/agua-vaso.png"
              alt="Vaso de agua"
              width={486}
              height={665}
              unoptimized
              className="w-full h-auto drop-shadow-2xl"
            />
          </div>
          {/* Sombra suave debajo del celular */}
          <div className="absolute left-[8%] right-[8%] -bottom-3 h-4 bg-black/40 blur-md rounded-full" />
        </div>
      </div>
    </div>
  );
}

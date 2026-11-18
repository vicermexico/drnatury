import Image from "next/image";
import { PublicChatDemo } from "./PublicChatDemo";

// Pagina publica (sin login) para mandar aqui el trafico de los
// anuncios de Facebook/Instagram directo al chat de DrNatury, en vez
// de a WhatsApp. El primer mensaje viene fijo (el escrito del
// anuncio) y no se puede editar ni borrar nada -- solo mandarlo y
// platicar normal despues, hasta que quede agendada la cita.
export default function DemoWhatsappPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-emerald-50 flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex flex-col items-center text-center gap-1">
          <Image
            src="/drnatury-logo-full.png"
            alt="DrNatury"
            width={200}
            height={100}
            unoptimized
            className="object-contain"
            priority
          />
          <p className="text-sm text-gray-500">Chatea con nosotros para agendar tu cita</p>
        </div>
        <PublicChatDemo />
        <p className="text-center text-[11px] text-gray-400">
          🌿 Bienestar integral y natural
        </p>
      </div>
    </div>
  );
}

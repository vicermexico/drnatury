import Image from "next/image";
import { PublicChatDemo } from "./PublicChatDemo";

// Pagina publica (sin login) para mandar aqui el trafico de los
// anuncios de Facebook/Instagram directo al chat de DrNatury, en vez
// de a WhatsApp. El primer mensaje viene fijo (el escrito del
// anuncio) y no se puede editar ni borrar nada -- solo mandarlo y
// platicar normal despues, hasta que quede agendada la cita.
export default function DemoWhatsappPage() {
  return (
    // En el celular la altura se fija a lo que realmente se ve en pantalla
    // (100dvh, que sí descuenta la barra del navegador) para que el cuadro
    // de "Escribe tu mensaje..." nunca quede cortado fuera de la vista. En
    // pantallas grandes se deja como estaba (scroll normal de la pagina).
    <div className="h-[100dvh] overflow-hidden overscroll-none sm:h-auto sm:min-h-screen sm:overflow-visible bg-gradient-to-b from-emerald-50 via-white to-emerald-50 flex flex-col items-center py-3 px-4 sm:py-6">
      <div className="w-full max-w-md h-full sm:h-auto flex flex-col gap-2 sm:gap-4">
        <div className="shrink-0 flex flex-col items-center text-center gap-1">
          <Image
            src="/drnatury-logo-full.png"
            alt="DrNatury"
            width={200}
            height={100}
            unoptimized
            className="object-contain w-36 sm:w-[200px] h-auto"
            priority
          />
          <p className="text-sm text-gray-500">Chatea con nosotros para agendar tu cita</p>
        </div>
        <PublicChatDemo />
        <p className="shrink-0 text-center text-[11px] text-gray-400">
          🌿 Bienestar integral y natural
        </p>
      </div>
    </div>
  );
}

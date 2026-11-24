import { createAdminClient } from "@/lib/supabase/admin";
import { PublicChatDemo } from "./PublicChatDemo";

// Pagina publica (sin login) para mandar aqui el trafico de los
// anuncios de Facebook/Instagram directo al chat de DrNatury, en vez
// de a WhatsApp. El primer mensaje viene fijo (el escrito del
// anuncio) y no se puede editar ni borrar nada -- solo mandarlo y
// platicar normal despues, hasta que quede agendada la cita.
//
// A proposito NO lleva logo, texto ni fondo de color alrededor -- el
// chat ocupa toda la pantalla, igual que cuando se abre WhatsApp de
// verdad (sin nada de DrNatury atras del cuadro del chat).
export default async function DemoWhatsappPage() {
  // Nombre, foto y link del anuncio de Facebook que se ven en el
  // encabezado del chat y en su pantalla de opciones -- los edita
  // Master desde /master/asistente-whatsapp (bot "consultas"). Desde la
  // Fase 1 del bot de venta de productos cada bot trae su propio perfil
  // en la tabla whatsapp_bots, ya no en landing_config.
  const admin = createAdminClient();
  const { data: config } = await admin
    .from("whatsapp_bots")
    .select("chat_perfil_nombre, chat_perfil_foto, anuncio_facebook_url")
    .eq("slug", "consultas")
    .maybeSingle();

  return (
    // En el celular la altura se fija a lo que realmente se ve en pantalla
    // (100dvh, que sí descuenta la barra del navegador) para que el cuadro
    // de "Escribe tu mensaje..." nunca quede cortado fuera de la vista.
    <div className="h-[100dvh] overflow-hidden overscroll-none bg-white flex flex-col items-center sm:py-6">
      <div className="w-full max-w-md h-full flex flex-col">
        <PublicChatDemo
          bot="consultas"
          perfilNombre={config?.chat_perfil_nombre || "DrNatury"}
          perfilFoto={config?.chat_perfil_foto ?? null}
          facebookUrl={config?.anuncio_facebook_url ?? null}
        />
      </div>
    </div>
  );
}

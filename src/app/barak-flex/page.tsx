import { createAdminClient } from "@/lib/supabase/admin";
import { PublicChatDemo } from "../chat/PublicChatDemo";

// Pagina publica (sin login) del bot de venta de Pomada Barak Flex --
// chat totalmente aparte del de consultas (drnatury.com/chat), para el
// trafico de la campaña de Facebook/Instagram de la pomada (ver Fase 1
// del bot de venta de productos). Mismo componente de chat que /chat,
// nomas que aqui se le manda el bot "pomada" para que conteste con su
// propia bienvenida, anuncios, correcciones y ubicaciones.
export default async function BarakFlexPage() {
  const admin = createAdminClient();
  const { data: config } = await admin
    .from("whatsapp_bots")
    .select("chat_perfil_nombre, chat_perfil_foto, anuncio_facebook_url, mensaje_inicial_anuncio, chat_whatsapp_numero")
    .eq("slug", "pomada")
    .maybeSingle();

  return (
    <div className="h-[100dvh] overflow-hidden overscroll-none bg-white flex flex-col items-center sm:py-6">
      <div className="w-full max-w-md h-full flex flex-col">
        <PublicChatDemo
          bot="pomada"
          perfilNombre={config?.chat_perfil_nombre || "Pomada Barak Flex"}
          perfilFoto={config?.chat_perfil_foto ?? null}
          facebookUrl={config?.anuncio_facebook_url ?? null}
          mensajeInicialAnuncio={config?.mensaje_inicial_anuncio || undefined}
          whatsappNumero={config?.chat_whatsapp_numero || undefined}
        />
      </div>
    </div>
  );
}

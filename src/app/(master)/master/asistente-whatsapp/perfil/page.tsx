import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChatPerfilEditor } from "../ChatPerfilEditor";
import { esBotSlugValido } from "@/lib/whatsapp-bot/bots";

export default async function PerfilChatPage({
  searchParams,
}: {
  searchParams: Promise<{ bot?: string }>;
}) {
  const { bot: botParam } = await searchParams;
  const bot = esBotSlugValido(botParam) ? botParam : "consultas";

  const admin = createAdminClient();
  const { data: config } = await admin
    .from("whatsapp_bots")
    .select("chat_perfil_nombre, chat_perfil_foto, anuncio_facebook_url, mensaje_inicial_anuncio")
    .eq("slug", bot)
    .maybeSingle();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`/master/asistente-whatsapp?bot=${bot}`} className="text-sm text-blue-600 hover:underline">
          ← Asistente de WhatsApp
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Perfil del chat</h1>
        <p className="text-sm text-gray-500 mt-1">
          Así se ve el chat para el paciente (nombre, foto y link del anuncio de Facebook).
        </p>
      </div>
      <ChatPerfilEditor
        bot={bot}
        nombreInicial={config?.chat_perfil_nombre || "DrNatury"}
        fotoInicial={config?.chat_perfil_foto ?? null}
        facebookUrlInicial={config?.anuncio_facebook_url ?? null}
        mensajeInicialAnuncioInicial={config?.mensaje_inicial_anuncio || "¡Hola! ¿Podrían darme más información?"}
      />
    </div>
  );
}

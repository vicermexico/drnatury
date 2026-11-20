import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChatPerfilEditor } from "../ChatPerfilEditor";

export default async function PerfilChatPage() {
  const admin = createAdminClient();
  const { data: config } = await admin
    .from("landing_config")
    .select("chat_perfil_nombre, chat_perfil_foto, anuncio_facebook_url")
    .limit(1)
    .maybeSingle();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/master/asistente-whatsapp" className="text-sm text-blue-600 hover:underline">
          ← Asistente de WhatsApp
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Perfil del chat</h1>
        <p className="text-sm text-gray-500 mt-1">
          Así se ve el chat para el paciente (nombre, foto y link del anuncio de Facebook).
        </p>
      </div>
      <ChatPerfilEditor
        nombreInicial={config?.chat_perfil_nombre || "DrNatury"}
        fotoInicial={config?.chat_perfil_foto ?? null}
        facebookUrlInicial={config?.anuncio_facebook_url ?? null}
      />
    </div>
  );
}

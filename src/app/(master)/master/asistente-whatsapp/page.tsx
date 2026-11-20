import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AsistenteChatDemo } from "./AsistenteChatDemo";
import { AnunciosManager } from "./AnunciosManager";
import { BienvenidaManager } from "./BienvenidaManager";
import { CorreccionesManager } from "./CorreccionesManager";
import { ChatPerfilEditor } from "./ChatPerfilEditor";

export default async function AsistenteWhatsappPage() {
  const admin = createAdminClient();
  const { data: config } = await admin
    .from("landing_config")
    .select("chat_perfil_nombre, chat_perfil_foto, anuncio_facebook_url")
    .limit(1)
    .maybeSingle();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asistente de WhatsApp (demo)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Aqui platicas como si fueras un paciente para probar y entrenar al bot --
            todavia NO esta conectado a tu WhatsApp real, es solo de prueba.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/master/asistente-whatsapp/revision"
            className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition"
          >
            Revisión
          </Link>
          <Link
            href="/master/asistente-whatsapp/mensajes"
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition"
          >
            Ver mensajes
          </Link>
        </div>
      </div>
      <ChatPerfilEditor
        nombreInicial={config?.chat_perfil_nombre || "DrNatury"}
        fotoInicial={config?.chat_perfil_foto ?? null}
        facebookUrlInicial={config?.anuncio_facebook_url ?? null}
      />
      <BienvenidaManager />
      <AnunciosManager />
      <CorreccionesManager />
      <AsistenteChatDemo />
    </div>
  );
}

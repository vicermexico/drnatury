import Link from "next/link";
import { AsistenteChatDemo } from "./AsistenteChatDemo";
import { AnunciosManager } from "./AnunciosManager";
import { BienvenidaManager } from "./BienvenidaManager";

export default function AsistenteWhatsappPage() {
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
        <Link
          href="/master/asistente-whatsapp/mensajes"
          className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition"
        >
          Ver mensajes
        </Link>
      </div>
      <BienvenidaManager />
      <AnunciosManager />
      <AsistenteChatDemo />
    </div>
  );
}

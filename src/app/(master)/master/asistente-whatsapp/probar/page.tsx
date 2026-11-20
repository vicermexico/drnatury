import Link from "next/link";
import { AsistenteChatDemo } from "../AsistenteChatDemo";

export default function ProbarBotPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/master/asistente-whatsapp" className="text-sm text-blue-600 hover:underline">
          ← Asistente de WhatsApp
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Probar y entrenar al bot</h1>
        <p className="text-sm text-gray-500 mt-1">
          Escribe aquí como si fueras un paciente nuevo para probar y entrenar al bot -- todavía
          NO está conectado a tu WhatsApp real, es solo de prueba.
        </p>
      </div>
      <AsistenteChatDemo />
    </div>
  );
}

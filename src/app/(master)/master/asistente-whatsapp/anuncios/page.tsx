import Link from "next/link";
import { AnunciosManager } from "../AnunciosManager";

export default function AnunciosPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/master/asistente-whatsapp" className="text-sm text-blue-600 hover:underline">
          ← Asistente de WhatsApp
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Escritos de mis anuncios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sube aquí los mensajes pre-llenados de tus anuncios para que el bot sepa reconocerlos.
        </p>
      </div>
      <AnunciosManager />
    </div>
  );
}

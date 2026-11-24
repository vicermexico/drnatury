import Link from "next/link";
import { AnunciosManager } from "../AnunciosManager";
import { esBotSlugValido } from "@/lib/whatsapp-bot/bots";

export default async function AnunciosPage({
  searchParams,
}: {
  searchParams: Promise<{ bot?: string }>;
}) {
  const { bot: botParam } = await searchParams;
  const bot = esBotSlugValido(botParam) ? botParam : "consultas";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`/master/asistente-whatsapp?bot=${bot}`} className="text-sm text-blue-600 hover:underline">
          ← Asistente de WhatsApp
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Escritos de mis anuncios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sube aquí los mensajes pre-llenados de tus anuncios para que el bot sepa reconocerlos.
        </p>
      </div>
      <AnunciosManager bot={bot} />
    </div>
  );
}

import Link from "next/link";
import { BienvenidaManager } from "../BienvenidaManager";
import { esBotSlugValido } from "@/lib/whatsapp-bot/bots";

export default async function BienvenidaPage({
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
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Mensajes de bienvenida</h1>
        <p className="text-sm text-gray-500 mt-1">
          Arma aquí, en el orden que quieras, los audios y textos que se mandan al inicio.
        </p>
      </div>
      <BienvenidaManager bot={bot} />
    </div>
  );
}

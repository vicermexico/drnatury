import Link from "next/link";
import { UbicacionesManager } from "../UbicacionesManager";
import { esBotSlugValido } from "@/lib/whatsapp-bot/bots";

export default async function UbicacionesPage({
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
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Ubicaciones</h1>
        <p className="text-sm text-gray-500 mt-1">
          Guarda el pin de GPS de cada consultorio parado físicamente ahí, para que el bot lo mande cuando
          alguien pida la ubicación o la dirección.
        </p>
      </div>
      <UbicacionesManager bot={bot} />
    </div>
  );
}

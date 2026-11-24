import Link from "next/link";
import { redirect } from "next/navigation";
import { esBotSlugValido } from "@/lib/whatsapp-bot/bots";
import { LinksPanel } from "./LinksPanel";

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<{ bot?: string }>;
}) {
  const { bot } = await searchParams;
  if (!esBotSlugValido(bot)) redirect("/master/asistente-whatsapp");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`/master/asistente-whatsapp?bot=${bot}`} className="text-sm text-blue-600 hover:underline">
          ← Menú del bot
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Links</h1>
        <p className="text-sm text-gray-500 mt-1">
          Genera un link distinto para cada anuncio o campaña, para saber de cuál vino cada cliente.
        </p>
      </div>

      <LinksPanel bot={bot} />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { esBotSlugValido } from "@/lib/whatsapp-bot/bots";
import { ProductosPanel } from "./ProductosPanel";

export default async function ProductosPage({
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
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Productos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sube tus productos con nombre, descripción, precio y fotos para que el bot los pueda mostrar.
        </p>
      </div>

      <ProductosPanel bot={bot} />
    </div>
  );
}

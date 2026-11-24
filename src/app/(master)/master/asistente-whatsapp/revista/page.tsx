import Link from "next/link";
import { redirect } from "next/navigation";
import { esBotSlugValido, botVendeProductos } from "@/lib/whatsapp-bot/bots";
import { RevistaPanel } from "./RevistaPanel";
import "@/styles/stPageFlip.css";

// Pantalla "revista": muestra los productos reales de este bot como si
// fueran paginas de una revista digital que se pueden voltear, con
// "Ver mas" (detalle completo) y "Compartir" por producto -- es la
// Pieza 2 de lo que pidio Vic (la Pieza 3, conectar esto al chat real
// del cliente, va aparte). Usa la misma fuente de datos que el panel
// de "Productos" (tabla productos + producto_fotos).
export default async function RevistaPage({
  searchParams,
}: {
  searchParams: Promise<{ bot?: string }>;
}) {
  const { bot } = await searchParams;
  if (!esBotSlugValido(bot) || !botVendeProductos(bot)) redirect("/master/asistente-whatsapp");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`/master/asistente-whatsapp?bot=${bot}`} className="text-sm text-blue-600 hover:underline">
          ← Menú del bot
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Revista</h1>
        <p className="text-sm text-gray-500 mt-1">
          Así se vería tu catálogo como revista -- de aquí nada más se ve y se revisa; los productos se suben y editan
          en &quot;Productos&quot;.
        </p>
      </div>

      <RevistaPanel bot={bot} />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { esBotSlugValido, type BotSlug } from "@/lib/whatsapp-bot/bots";
import { RutasPanel } from "./RutasPanel";

async function getChoferesActivos(bot: BotSlug) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, name")
    .contains("roles", ["CHOFER"])
    .eq("chofer_bot_slug", bot)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");
  return data ?? [];
}

export default async function RutasPage({
  searchParams,
}: {
  searchParams: Promise<{ bot?: string }>;
}) {
  const { bot } = await searchParams;
  if (!esBotSlugValido(bot)) redirect("/master/asistente-whatsapp");

  const choferes = await getChoferesActivos(bot);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href={`/master/asistente-whatsapp?bot=${bot}`} className="text-sm text-blue-600 hover:underline">
          ← Menú del bot
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Rutas de entrega</h1>
        <p className="text-sm text-gray-500 mt-1">
          Agrupa los pedidos pendientes por cercanía y asígnalos a un chofer.
        </p>
      </div>

      <RutasPanel bot={bot} choferes={choferes} />
    </div>
  );
}

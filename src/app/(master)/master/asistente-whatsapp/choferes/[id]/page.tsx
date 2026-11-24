import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { esBotSlugValido, type BotSlug } from "@/lib/whatsapp-bot/bots";
import { ChoferActions } from "./ChoferActions";

async function getChofer(id: string, bot: BotSlug) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, name, phone, is_active")
    .eq("id", id)
    .contains("roles", ["CHOFER"])
    .eq("chofer_bot_slug", bot)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default async function ChoferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bot?: string }>;
}) {
  const { id } = await params;
  const { bot } = await searchParams;
  if (!esBotSlugValido(bot)) redirect("/master/asistente-whatsapp");

  const chofer = await getChofer(id, bot);
  if (!chofer) notFound();
  const q = `?bot=${bot}`;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm mb-3">
          <Link href={`/master/asistente-whatsapp/choferes${q}`} className="text-gray-400 hover:text-gray-600">Choferes</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">{chofer.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{chofer.name}</h1>
          {!chofer.is_active && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">Inactivo</span>
          )}
        </div>
      </div>

      <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Información</h2>
        <Row label="Teléfono" value={chofer.phone} />
        <Row label="Acceso" value="Panel de entregas" />
      </section>

      <ChoferActions
        bot={bot}
        chofer={{
          id:        chofer.id,
          name:      chofer.name,
          phone:     chofer.phone,
          is_active: chofer.is_active,
        }}
      />
    </div>
  );
}

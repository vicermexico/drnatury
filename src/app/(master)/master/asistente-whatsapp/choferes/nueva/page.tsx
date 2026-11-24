import Link from "next/link";
import { redirect } from "next/navigation";
import { ChoferForm } from "@/components/forms/ChoferForm";
import { esBotSlugValido } from "@/lib/whatsapp-bot/bots";

export default async function NuevoChoferPage({
  searchParams,
}: {
  searchParams: Promise<{ bot?: string }>;
}) {
  const { bot } = await searchParams;
  if (!esBotSlugValido(bot)) redirect("/master/asistente-whatsapp");
  const q = `?bot=${bot}`;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm mb-3">
          <Link href={`/master/asistente-whatsapp/choferes${q}`} className="text-gray-400 hover:text-gray-600">Choferes</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">Nuevo</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo chofer</h1>
        <p className="text-sm text-gray-500 mt-1">
          El chofer va a entrar a su panel de entregas con su celular y este PIN.
        </p>
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 p-5">
        <ChoferForm bot={bot} />
      </div>
    </div>
  );
}

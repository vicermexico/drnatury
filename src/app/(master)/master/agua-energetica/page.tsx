import { createAdminClient } from "@/lib/supabase/admin";
import { AguaEnergeticaConfig } from "./AguaEnergeticaConfig";

async function getConfig() {
  const admin = createAdminClient();
  const { data } = await admin.from("agua_energetica_config").select("*").single();
  return data;
}

export default async function MasterAguaEnergeticaPage() {
  const config = await getConfig();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agua Energetica</h1>
        <p className="text-sm text-gray-500 mt-1">Configura el servicio de Agua Energetica</p>
      </div>
      <AguaEnergeticaConfig config={config} />
    </div>
  );
}

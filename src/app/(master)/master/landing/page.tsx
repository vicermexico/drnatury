import { createAdminClient } from "@/lib/supabase/admin";
import { LandingEditor } from "@/components/landing/LandingEditor";

async function getConfig() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("landing_config")
    .select("*")
    .single();
  return data;
}

async function getServices() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("landing_services")
    .select("*")
    .order("order_index");
  return data ?? [];
}

export default async function LandingPage() {
  const config = await getConfig();
  const services = await getServices();

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Editar página de inicio</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configura lo que ven los pacientes antes de entrar
        </p>
      </div>

      <LandingEditor config={config} services={services} />
    </div>
  );
}

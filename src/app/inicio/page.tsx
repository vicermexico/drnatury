export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import { LandingPage } from "@/components/landing/LandingPage";

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
    .eq("is_active", true)
    .order("order_index");
  return data ?? [];
}

export default async function InicioPage() {
  const config = await getConfig();
  const services = await getServices();

  return <LandingPage config={config} services={services} />;
}


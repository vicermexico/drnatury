export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import { SplashWrapper } from "@/components/landing/SplashWrapper";

async function getConfig() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("landing_config")
    .select("splash_logo_url, splash_nombre_url, splash_mostrar_logo, splash_mostrar_nombre")
    .single();
  return data;
}

export default async function Home() {
  const config = await getConfig();
  return (
    <SplashWrapper
      logoUrl={config?.splash_logo_url}
      nombreUrl={config?.splash_nombre_url}
      mostrarLogo={config?.splash_mostrar_logo ?? true}
      mostrarNombre={config?.splash_mostrar_nombre ?? true}
    />
  );
}


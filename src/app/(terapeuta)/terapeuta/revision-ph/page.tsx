import { createAdminClient } from "@/lib/supabase/admin";
import { PhRevisionPanel } from "./PhRevisionPanel";

async function getConfig() {
  const admin = createAdminClient();
  const { data } = await admin.from("ph_revision_config").select("*").single();
  return data;
}

export default async function TerapeutaRevisionPhPage() {
  const config = await getConfig();
  return <PhRevisionPanel config={config} />;
}

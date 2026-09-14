import { createAdminClient } from "@/lib/supabase/admin";
import { PhRevisionConfig } from "./PhRevisionConfig";

async function getConfig() {
  const admin = createAdminClient();
  const { data } = await admin.from("ph_revision_config").select("*").single();
  return data;
}

export default async function MasterPhRevisionPage() {
  const config = await getConfig();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Revision de PH</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sube los videos que se muestran al terapeuta durante la revision de PH
        </p>
      </div>
      <PhRevisionConfig config={config} />
    </div>
  );
}

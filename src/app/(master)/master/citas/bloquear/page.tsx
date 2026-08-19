import { createAdminClient } from "@/lib/supabase/admin";
import { BloquearForm } from "./BloquearForm";

async function getBranches() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");
  return data ?? [];
}

export default async function BloquearPage() {
  const branches = await getBranches();
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bloquear horarios</h1>
        <p className="text-sm text-gray-500 mt-1">Bloquea dias u horas para que nadie pueda agendar</p>
      </div>
      <BloquearForm branches={branches} />
    </div>
  );
}

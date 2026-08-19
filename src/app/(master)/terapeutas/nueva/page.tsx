import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { TherapistForm } from "@/components/forms/TherapistForm";

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

export default async function NuevaTerapeutaPage() {
  const branches = await getBranches();

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master/terapeutas" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Terapeutas
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nueva terapeuta</h1>
      <TherapistForm branches={branches} />
    </div>
  );
}

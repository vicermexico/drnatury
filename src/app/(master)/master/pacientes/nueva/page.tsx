import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PatientForm } from "@/components/forms/PatientForm";

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

export default async function NuevoPacientePage() {
  const branches = await getBranches();

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master/pacientes" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Pacientes
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo paciente</h1>
      <PatientForm branches={branches} />
    </div>
  );
}

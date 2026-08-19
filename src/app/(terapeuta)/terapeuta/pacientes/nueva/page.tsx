import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PatientForm } from "@/components/forms/PatientForm";

export default async function NuevoPacienteTerapeutaPage() {
  const profile = await requireRole("TERAPEUTA");
  const branchId = profile.branch_id ?? "";

  const admin = createAdminClient();
  const { data: branch } = await admin
    .from("branches")
    .select("id, name")
    .eq("id", branchId)
    .single();

  const branches = branch ? [branch] : [];

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/terapeuta/pacientes" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Pacientes
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo paciente</h1>
      <PatientForm branches={branches} redirectTo="/terapeuta/pacientes" />
    </div>
  );
}

import Link from "next/link";
import { ServiceForm } from "@/components/forms/ServiceForm";
import { createAdminClient } from "@/lib/supabase/admin";

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

export default async function NuevoServicioPage() {
  const branches = await getBranches();
  return (
    <div className="max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master/servicios" className="text-gray-400 hover:text-gray-600 text-sm">
          &#8592; Servicios
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo servicio</h1>
      <ServiceForm branches={branches} />
    </div>
  );
}

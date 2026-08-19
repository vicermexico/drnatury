import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { TherapistActions } from "./TherapistActions";

async function getTherapist(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, name, phone, email, branch_id, is_active, branches(id, name)")
    .eq("id", id)
    .contains("roles", ["TERAPEUTA"])
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

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

export default async function TherapistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [therapist, branches] = await Promise.all([getTherapist(id), getBranches()]);

  if (!therapist) notFound();

  const branch = Array.isArray(therapist.branches)
    ? therapist.branches[0]
    : (therapist.branches as { id: string; name: string } | null);

  return (
    <div className="max-w-lg space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-sm mb-3">
          <Link href="/master/configuracion" className="text-gray-400 hover:text-gray-600">Configuración</Link>
          <span className="text-gray-300">/</span>
          <Link href="/master/terapeutas" className="text-gray-400 hover:text-gray-600">Terapeutas</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">{therapist.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{therapist.name}</h1>
          {!therapist.is_active && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
              Inactiva
            </span>
          )}
        </div>
      </div>

      {/* Datos */}
      <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Información</h2>
        <Row label="Teléfono" value={therapist.phone} />
        {therapist.email && <Row label="Correo" value={therapist.email} />}
        <Row label="Sucursal" value={branch?.name ?? "Sin asignar"} />
      </section>

      {/* Acciones */}
      <TherapistActions
        therapist={{
          id: therapist.id,
          name: therapist.name,
          email: therapist.email ?? null,
          branch_id: therapist.branch_id ?? null,
          is_active: therapist.is_active,
        }}
        branches={branches}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

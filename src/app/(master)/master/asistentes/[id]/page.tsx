import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AsistenteActions } from "./AsistenteActions";

async function getAsistente(id: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, name, phone, email, branch_id, is_active, branches(id, name)")
    .eq("id", id)
    .contains("roles", ["ASISTENTE"])
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default async function AsistenteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const asistente = await getAsistente(id);

  if (!asistente) notFound();

  const branch = Array.isArray(asistente.branches)
    ? asistente.branches[0]
    : asistente.branches as { id: string; name: string } | null;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm mb-3">
          <Link href="/master/asistentes" className="text-gray-400 hover:text-gray-600">Asistentes</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">{asistente.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{asistente.name}</h1>
          {!asistente.is_active && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">Inactivo</span>
          )}
        </div>
      </div>

      <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Información</h2>
        <Row label="Teléfono" value={asistente.phone} />
        {asistente.email && <Row label="Correo" value={asistente.email} />}
        <Row label="Acceso" value="Todas las sucursales" />
        <Row label="Permisos" value="Citas · Pacientes · Agenda" />
      </section>

      <AsistenteActions
        asistente={{
          id: asistente.id,
          name: asistente.name,
          phone: asistente.phone,
          email: asistente.email ?? null,
          branch_id: asistente.branch_id ?? null,
          is_active: asistente.is_active,
        }}
      />
    </div>
  );
}

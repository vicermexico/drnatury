import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { ServiceActions } from "./ServiceActions";
import { ServiceBranchPricing } from "@/components/forms/ServiceBranchPricing";

async function getService(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("services")
    .select(`
      id, name, duration_minutes, is_active,
      branch_services(price, simultaneous_capacity, branches(id, name))
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

async function getActiveBranches() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");
  return data ?? [];
}

function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [service, allBranches] = await Promise.all([getService(id), getActiveBranches()]);

  if (!service) notFound();

  type BranchServiceRow = {
    price: number;
    simultaneous_capacity: number;
    branches: { id: string; name: string } | null;
  };

  const branchServices = (service.branch_services ?? []) as unknown as BranchServiceRow[];

  // Separar en asignadas y sin asignar
  const assignedIds = new Set(branchServices.map((bs) => bs.branches?.id).filter(Boolean));

  const assigned = branchServices
    .filter((bs) => bs.branches != null)
.map((bs) => ({ branch: bs.branches!, price: bs.price, simultaneous_capacity: bs.simultaneous_capacity ?? 1 }));

  const unassigned = allBranches.filter((b) => !assignedIds.has(b.id));

  return (
    <div className="max-w-lg space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-sm mb-3">
          <Link href="/master/configuracion" className="text-gray-400 hover:text-gray-600">ConfiguraciÃ³n</Link>
          <span className="text-gray-300">/</span>
          <Link href="/master/servicios" className="text-gray-400 hover:text-gray-600">Servicios</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">{service.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{service.name}</h1>
          {!service.is_active && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
              Inactivo
            </span>
          )}
        </div>
      </div>

      {/* Datos */}
      <section className="rounded-2xl bg-white border border-gray-200 p-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">InformaciÃ³n</h2>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">DuraciÃ³n</span>
          <span className="font-medium text-gray-900">{formatDuration(service.duration_minutes)}</span>
        </div>
      </section>

      {/* Precios por sucursal â€” interactivo */}
      <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Precio por sucursal</h2>
          <p className="text-xs text-gray-400 mt-1">
            El servicio solo aparece en el agendado de las sucursales donde tenga precio asignado.
          </p>
        </div>
        <ServiceBranchPricing
          serviceId={service.id}
          assigned={assigned}
          unassigned={unassigned}
        />
      </section>

      {/* Editar / Eliminar el servicio */}
      <ServiceActions
        service={{
          id: service.id,
          name: service.name,
          duration_minutes: service.duration_minutes,
          is_active: service.is_active,
          simultaneous_capacity: (service as unknown as { simultaneous_capacity?: number }).simultaneous_capacity ?? 1,
        }}
      />
    </div>
  );
}





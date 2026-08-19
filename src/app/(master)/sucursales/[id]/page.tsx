import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { BranchServiceForm } from "@/components/forms/BranchServiceForm";

async function getBranchDetail(id: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("branches")
    .select(`
      id, name, address, simultaneous_capacity, is_active, schedule,
      branch_services(
        price,
        services(id, name, duration_minutes)
      )
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  return data;
}

async function getAllServices() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("services")
    .select("id, name, duration_minutes")
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

const DAY_LABELS: Record<string, string> = {
  monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles",
  thursday: "Jueves", friday: "Viernes", saturday: "Sábado", sunday: "Domingo",
};

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [branch, allServices] = await Promise.all([
    getBranchDetail(id),
    getAllServices(),
  ]);

  if (!branch) notFound();

  type BranchServiceRow = {
    price: number;
    services: { id: string; name: string; duration_minutes: number } | null;
  };

  const assignedServices = (branch.branch_services ?? []) as unknown as BranchServiceRow[];
  const assignedIds = new Set(assignedServices.map((bs) => bs.services?.id).filter(Boolean));
  const availableServices = allServices.filter((s) => !assignedIds.has(s.id));

  const schedule = (branch.schedule ?? {}) as Record<string, {
    open: boolean;
    morning_start?: string;
    morning_end?: string;
    afternoon_start?: string;
    afternoon_end?: string;
  }>;

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Link href="/master/sucursales" className="text-gray-400 hover:text-gray-600 text-sm">
            ← Sucursales
          </Link>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{branch.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{branch.address}</p>
          </div>
          {!branch.is_active && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
              Inactiva
            </span>
          )}
        </div>
      </div>

      {/* Capacidad */}
      <section className="rounded-2xl bg-white border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Configuración
        </h2>
        <p className="text-sm text-gray-700">
          <span className="font-medium">{branch.simultaneous_capacity}</span>{" "}
          {branch.simultaneous_capacity === 1 ? "persona" : "personas"} atendidas simultáneamente por bloque de 30 min
        </p>
      </section>

      {/* Horario */}
      <section className="rounded-2xl bg-white border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Horario de atención
        </h2>
        <div className="space-y-2">
          {Object.entries(DAY_LABELS).map(([key, label]) => {
            const day = schedule[key];
            if (!day?.open) {
              return (
                <div key={key} className="flex items-center gap-3 text-sm py-1">
                  <span className="w-24 text-gray-400">{label}</span>
                  <span className="text-gray-300">Cerrado</span>
                </div>
              );
            }
            const slots = [];
            if (day.morning_start && day.morning_end) {
              slots.push(`${day.morning_start} – ${day.morning_end}`);
            }
            if (day.afternoon_start && day.afternoon_end) {
              slots.push(`${day.afternoon_start} – ${day.afternoon_end}`);
            }
            return (
              <div key={key} className="flex items-center gap-3 text-sm py-1">
                <span className="w-24 font-medium text-gray-700">{label}</span>
                <span className="text-gray-600">{slots.join(" / ")}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Servicios asignados */}
      <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Servicios y precios
        </h2>

        {assignedServices.length === 0 ? (
          <p className="text-sm text-gray-400">
            Esta sucursal no tiene servicios asignados todavía.
          </p>
        ) : (
          <div className="space-y-2">
            {assignedServices.map((bs) => (
              <div
                key={bs.services?.id}
                className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{bs.services?.name}</p>
                  <p className="text-xs text-gray-400">
                    {formatDuration(bs.services?.duration_minutes ?? 0)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  ${bs.price.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Agregar servicio */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-3">Agregar servicio a esta sucursal</p>
          <BranchServiceForm
            branchId={branch.id}
            availableServices={availableServices}
          />
        </div>
      </section>
    </div>
  );
}

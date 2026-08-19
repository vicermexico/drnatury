import { notFound } from "next/navigation";

export const revalidate = 0;
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { BranchServiceForm } from "@/components/forms/BranchServiceForm";
import { BranchActions } from "./BranchActions";
import { GlobalModeToggle } from "@/components/forms/GlobalModeToggle";
import { MostrarCelularToggle } from "@/components/forms/MostrarCelularToggle";
import type { WeeklySchedule } from "@/types";

async function getBranch(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("branches")
    .select(`
      id, name, address, is_active, schedule, global_mode, global_capacity, mostrar_celular,
      branch_services(price, simultaneous_capacity, services(id, name, duration_minutes))
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
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

const DAY_LABELS: Record<string, string> = {
  monday: "Lunes", tuesday: "Martes", wednesday: "MiÃ©rcoles",
  thursday: "Jueves", friday: "Viernes", saturday: "SÃ¡bado", sunday: "Domingo",
};

function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [branch, allServices] = await Promise.all([getBranch(id), getAllServices()]);

  if (!branch) notFound();

  type BranchServiceRow = {
    price: number;
    services: { id: string; name: string; duration_minutes: number } | null;
  };

  const assignedServices = (branch.branch_services ?? []) as unknown as BranchServiceRow[];
  const assignedIds = new Set(assignedServices.map((bs) => bs.services?.id).filter(Boolean));
  const availableServices = allServices.filter((s) => !assignedIds.has(s.id));
  const schedule = (branch.schedule ?? {}) as WeeklySchedule;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-sm mb-3">
          <span className="text-gray-300">/</span>
          <Link href="/master/sucursales" className="text-gray-400 hover:text-gray-600">Sucursales</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">{branch.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{branch.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{branch.address}</p>
          </div>
          {!branch.is_active && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
              Inactiva
            </span>
          )}
        </div>
      </div>

      <section className="rounded-2xl bg-white border border-gray-200 p-5">
        <p className="text-sm text-gray-700">
        </p>
      </section>

      {/* Horario */}
      <section className="rounded-2xl bg-white border border-gray-200 p-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Horario</h2>
        <div className="space-y-1.5">
          {Object.entries(DAY_LABELS).map(([key, label]) => {
            const day = (schedule as Record<string, { open: boolean; morning_start?: string; morning_end?: string; afternoon_start?: string; afternoon_end?: string }>)[key];
            if (!day?.open) {
              return (
                <div key={key} className="flex items-center gap-3 text-sm py-1">
                  <span className="w-24 text-gray-400">{label}</span>
                  <span className="text-gray-300 text-xs">Cerrado</span>
                </div>
              );
            }
            const slots: string[] = [];
            if (day.morning_start && day.morning_end) slots.push(`${day.morning_start} â€“ ${day.morning_end}`);
            if (day.afternoon_start && day.afternoon_end) slots.push(`${day.afternoon_start} â€“ ${day.afternoon_end}`);
            return (
              <div key={key} className="flex items-center gap-3 text-sm py-1">
                <span className="w-24 font-medium text-gray-700">{label}</span>
                <span className="text-gray-600 text-xs">{slots.join(" / ")}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Modo Global */}
      <GlobalModeToggle
        branchId={branch.id}
        globalMode={(branch as unknown as { global_mode: boolean }).global_mode ?? false}
        globalCapacity={(branch as unknown as { global_capacity: number }).global_capacity ?? 1}
      />

      {/* Mostrar celular */}
      <MostrarCelularToggle
        branchId={branch.id}
        mostrarCelular={(branch as unknown as { mostrar_celular: boolean }).mostrar_celular ?? true}
      />

      {/* Servicios asignados */}
      <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Servicios y precios</h2>

        {assignedServices.length === 0 ? (
          <p className="text-sm text-gray-400">Sin servicios asignados todavÃ­a.</p>
        ) : (
          <div className="space-y-2">
            {assignedServices.map((bs) => (
              <div key={bs.services?.id}
                className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{bs.services?.name}</p>
                  <p className="text-xs text-gray-400">{formatDuration(bs.services?.duration_minutes ?? 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">${bs.price.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-3">Agregar servicio a esta sucursal</p>
          <BranchServiceForm branchId={branch.id} availableServices={availableServices} />
        </div>
      </section>

      {/* Editar / Eliminar */}
      <BranchActions branch={{
        id: branch.id,
        name: branch.name,
        address: branch.address,
        schedule: schedule,
      }} />
    </div>
  );
}














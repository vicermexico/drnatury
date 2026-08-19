import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

async function getServices() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("services")
    .select(`
      id, name, duration_minutes, is_active,
      branch_services(price, branches(id, name))
    `)
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

export default async function ServiciosPage() {
  const services = await getServices();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
          <p className="text-sm text-gray-500 mt-1">
            {services.length} servicio{services.length !== 1 ? "s" : ""} en el catálogo
          </p>
        </div>
        <Link
          href="/master/servicios/nuevo"
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          + Nuevo servicio
        </Link>
      </div>

      {services.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 text-sm mb-3">No hay servicios en el catálogo</p>
          <Link href="/master/servicios/nuevo" className="text-blue-600 text-sm underline">
            Crear el primer servicio
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((s) => {
            const branchServices = (s.branch_services ?? []) as unknown as Array<{
              price: number;
              branches: { id: string; name: string } | null;
            }>;
            return (
              <div
                key={s.id}
                className="rounded-2xl bg-white border border-gray-200 px-5 py-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDuration(s.duration_minutes)}
                    </p>
                  </div>
                  {!s.is_active && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      Inactivo
                    </span>
                  )}
                </div>

                {branchServices.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {branchServices.map((bs) => (
                      <span
                        key={bs.branches?.id}
                        className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full"
                      >
                        {bs.branches?.name} — ${bs.price}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

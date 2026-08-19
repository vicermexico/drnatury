import Link from "next/link";

export const revalidate = 0;
import { createAdminClient } from "@/lib/supabase/admin";

async function getBranches() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("branches")
    .select("id, name, address, simultaneous_capacity, global_mode, global_capacity, is_active")
    .is("deleted_at", null)
    .order("name");
  return data ?? [];
}

export default async function SucursalesPage() {
  const branches = await getBranches();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sucursales</h1>
          <p className="text-sm text-gray-500 mt-1">{branches.length} sucursal{branches.length !== 1 ? "es" : ""}</p>
        </div>
        <Link
          href="/master/sucursales/nueva"
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          + Nueva sucursal
        </Link>
      </div>

      {branches.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 text-sm mb-3">No hay sucursales registradas</p>
          <Link
            href="/master/sucursales/nueva"
            className="text-blue-600 text-sm underline"
          >
            Crear la primera sucursal
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map((b) => (
            <Link
              key={b.id}
              href={`/master/sucursales/${b.id}`}
              className="flex items-center justify-between rounded-2xl bg-white border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition group"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-700">
                    {b.name}
                  </p>
                  {!b.is_active && (
                    <span className="shrink-0 text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      Inactiva
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{b.address}</p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="text-sm font-medium text-gray-700">
                  {(b as {global_mode:boolean;global_capacity:number;simultaneous_capacity:number}).global_mode ? `x${(b as {global_capacity:number}).global_capacity} global` : `x${(b as {simultaneous_capacity:number}).simultaneous_capacity}`}
                </p>
                <p className="text-[11px] text-gray-400">simultÃ¡neas</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}





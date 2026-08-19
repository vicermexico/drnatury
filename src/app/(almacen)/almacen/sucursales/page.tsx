import { createAdminClient } from "@/lib/supabase/admin";

async function getSucursales() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("branches")
    .select("id, name, address, is_active, profiles(name, phone, roles, is_active, deleted_at)")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}

export default async function AlmacenSucursalesPage() {
  const sucursales = await getSucursales();

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sucursales</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {sucursales.length} sucursal{sucursales.length !== 1 ? "es" : ""} activa{sucursales.length !== 1 ? "s" : ""}
        </p>
      </div>

      {sucursales.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-400 text-sm">No hay sucursales activas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sucursales.map((s) => {
            const perfiles = Array.isArray(s.profiles) ? s.profiles : s.profiles ? [s.profiles] : [];
            const terapeutas = perfiles.filter((p: {roles: string[]; is_active?: boolean; deleted_at?: string | null}) => p.roles?.includes("TERAPEUTA") && p.is_active !== false && !p.deleted_at);
            return (
              <div key={s.id} className="rounded-2xl bg-white border border-gray-200 px-5 py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Activa</span>
                </div>
                {s.address && <p className="text-xs text-gray-500">ðŸ“ {s.address}</p>}
                {s.phone && <p className="text-xs text-gray-500">ðŸ“ž {s.phone}</p>}
                {terapeutas.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 mb-1">Terapeutas</p>
                    {terapeutas.map((t: {name: string; phone: string}, i: number) => (
                      <div key={i} className="flex items-center justify-between">
                        <p className="text-xs text-gray-700">{t.name}</p>
                        {t.phone && <p className="text-sm font-semibold text-blue-600">ðŸ“± {t.phone}</p>}
                      </div>
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



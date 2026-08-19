import { createAdminClient } from "@/lib/supabase/admin";

async function getPatients(search?: string) {
  const admin = createAdminClient();
  let query = admin
    .from("profiles")
    .select("id, name, phone, age, city, branch_id, created_at, branches(name)")
    .contains("roles", ["PACIENTE"])
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data } = await query;
  return data ?? [];
}

export default async function AsistentePacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const patients = await getPatients(q);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
        <p className="text-sm text-gray-500 mt-1">{patients.length} paciente{patients.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Búsqueda */}
      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o teléfono…"
          className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <button type="submit"
          className="rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition">
          Buscar
        </button>
        {q && (
          <a href="/asistente/pacientes"
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition">
            Limpiar
          </a>
        )}
      </form>

      {patients.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 text-sm">
            {q ? `Sin resultados para "${q}"` : "No hay pacientes registrados"}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Teléfono</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Sucursal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {patients.map(p => {
                const branch = Array.isArray(p.branches) ? p.branches[0] : p.branches as { name: string } | null;
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{p.name}</p>
                      {p.age && <p className="text-xs text-gray-400">{p.age} años{p.city ? ` · ${p.city}` : ""}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 hidden sm:table-cell">{p.phone}</td>
                    <td className="px-5 py-3.5 text-gray-500 hidden md:table-cell">
                      {branch?.name ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

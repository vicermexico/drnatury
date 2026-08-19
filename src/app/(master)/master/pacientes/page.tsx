import Link from "next/link";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { SearchInput } from "@/components/ui/SearchInput";

async function getPatients(q?: string) {
  const admin = createAdminClient();
  let query = admin
    .from("profiles")
    .select("id, name, phone, city, birth_date, age, is_active, created_at, branches(name)")
    .contains("roles", ["PACIENTE"])
    .is("deleted_at", null)
    .order("name");

  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
  }

  const { data } = await query;
  return data ?? [];
}

async function getStats() {
  const admin = createAdminClient();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totalRes, monthRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .contains("roles", ["PACIENTE"])
      .is("deleted_at", null),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .contains("roles", ["PACIENTE"])
      .is("deleted_at", null)
      .gte("created_at", startOfMonth.toISOString()),
  ]);

  return { total: totalRes.count ?? 0, thisMonth: monthRes.count ?? 0 };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric", month: "short", year: "numeric",
    timeZone: "America/Monterrey",
  });
}

function getAge(birthDate: string | null, age: number | null): string | null {
  if (birthDate) {
    const birth = new Date(birthDate);
    const today = new Date();
    let a = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
    return `${a} años`;
  }
  if (age) return `${age} años`;
  return null;
}

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [patients, stats] = await Promise.all([getPatients(q), getStats()]);
  const isFiltered = !!q?.trim();

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stats.total} registrado{stats.total !== 1 ? "s" : ""}
            {stats.thisMonth > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                +{stats.thisMonth} este mes
              </span>
            )}
          </p>
        </div>
        <Link
          href="/master/pacientes/nueva"
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition shrink-0"
        >
          + Nuevo paciente
        </Link>
      </div>

      {/* Buscador */}
      <Suspense>
        <SearchInput placeholder="Buscar por nombre o teléfono…" />
      </Suspense>

      {/* Lista */}
      {patients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          {isFiltered ? (
            <p className="text-gray-400 text-sm">
              Sin resultados para <span className="font-medium text-gray-600">&ldquo;{q}&rdquo;</span>
            </p>
          ) : (
            <>
              <p className="text-gray-400 text-sm mb-3">Aún no hay pacientes registrados</p>
              <Link href="/master/pacientes/nueva" className="text-blue-600 text-sm underline">
                Registrar el primer paciente
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {isFiltered && (
            <p className="text-xs text-gray-400">
              {patients.length} resultado{patients.length !== 1 ? "s" : ""} para &ldquo;{q}&rdquo;
            </p>
          )}
          {patients.map((p) => {
            const branch = Array.isArray(p.branches) ? p.branches[0] : p.branches as { name: string } | null;
            const ageStr = getAge(p.birth_date as string | null, p.age as number | null);
            return (
              <Link
                key={p.id}
                href={`/master/pacientes/${p.id}`}
                className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                    {!p.is_active && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.phone}
                    {ageStr ? ` · ${ageStr}` : ""}
                    {branch ? ` · ${branch.name}` : ""}
                    {p.city ? ` · ${p.city}` : ""}
                  </p>
                </div>
                <p className="text-xs text-gray-400 shrink-0 ml-4">{formatDate(p.created_at)}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

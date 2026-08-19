import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

async function getAsistentes() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, name, phone, email, is_active, branches(name)")
    .contains("roles", ["ASISTENTE"])
    .is("deleted_at", null)
    .order("name");
  return data ?? [];
}

export default async function AsistentesPage() {
  const asistentes = await getAsistentes();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asistentes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {asistentes.length} asistente{asistentes.length !== 1 ? "s" : ""} registrado{asistentes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/master/asistentes/nueva"
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition">
          + Nuevo asistente
        </Link>
      </div>

      {asistentes.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 text-sm mb-3">No hay asistentes registrados</p>
          <Link href="/master/asistentes/nueva" className="text-blue-600 text-sm underline">
            Agregar el primer asistente
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {asistentes.map(a => {
            const branch = Array.isArray(a.branches) ? a.branches[0] : a.branches as { name: string } | null;
            return (
              <Link key={a.id} href={`/master/asistentes/${a.id}`}
                className="flex items-center justify-between rounded-2xl bg-white border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{a.name}</p>
                    {!a.is_active && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.phone}{branch ? ` · ${branch.name}` : ""}
                  </p>
                </div>
                <span className="text-gray-300 text-sm">›</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

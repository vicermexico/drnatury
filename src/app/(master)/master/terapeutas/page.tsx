import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

async function getTherapists() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, name, phone, email, is_active, branches(id, name)")
    .contains("roles", ["TERAPEUTA"])
    .is("deleted_at", null)
    .order("name");
  return data ?? [];
}

export default async function TerapeutasPage() {
  const therapists = await getTherapists();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Terapeutas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {therapists.length} terapeuta{therapists.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/master/terapeutas/nueva"
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          + Nueva terapeuta
        </Link>
      </div>

      {therapists.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 text-sm mb-3">No hay terapeutas registradas</p>
          <Link href="/master/terapeutas/nueva" className="text-blue-600 text-sm underline">
            Registrar la primera terapeuta
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {therapists.map((t) => {
            const branch = Array.isArray(t.branches) ? t.branches[0] : t.branches;
            return (
              <Link
                key={t.id}
                href={`/master/terapeutas/${t.id}`}
                className="flex items-center justify-between rounded-2xl bg-white border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-700">{t.name}</p>
                    {!t.is_active && (
                      <span className="shrink-0 text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        Inactiva
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t.phone}
                    {branch && ` · ${(branch as { name: string }).name}`}
                  </p>
                </div>
                <span className="text-gray-300 group-hover:text-blue-400 shrink-0 ml-4">→</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

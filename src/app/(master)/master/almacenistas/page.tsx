import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

async function getAlmacenistas() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, name, phone, email, is_active")
    .contains("roles", ["ALMACENISTA"])
    .is("deleted_at", null)
    .order("name");
  return data ?? [];
}

export default async function AlmacenistasPage() {
  const almacenistas = await getAlmacenistas();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Almacenistas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {almacenistas.length} almacenista{almacenistas.length !== 1 ? "s" : ""} registrado{almacenistas.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/master/almacenistas/nueva"
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition">
          + Nuevo almacenista
        </Link>
      </div>

      {almacenistas.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 text-sm mb-3">No hay almacenistas registrados</p>
          <Link href="/master/almacenistas/nueva" className="text-blue-600 text-sm underline">
            Agregar el primer almacenista
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {almacenistas.map(a => (
            <Link key={a.id} href={`/master/almacenistas/${a.id}`}
              className="flex items-center justify-between rounded-2xl bg-white border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{a.name}</p>
                  {!a.is_active && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{a.phone}</p>
              </div>
              <span className="text-gray-300 text-sm">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import { createAdminClient } from "@/lib/supabase/admin";
import { RutasPanel } from "./RutasPanel";

async function getChoferesActivos() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, name")
    .contains("roles", ["CHOFER"])
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");
  return data ?? [];
}

export default async function RutasPage() {
  const choferes = await getChoferesActivos();

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rutas de entrega</h1>
        <p className="text-sm text-gray-500 mt-1">
          Agrupa los pedidos pendientes por cercanía y asígnalos a un chofer.
        </p>
      </div>

      <RutasPanel choferes={choferes} />
    </div>
  );
}

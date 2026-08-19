import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

async function getSucursalesConStock() {
  const admin = createAdminClient();

  const { data: branches } = await admin
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");

  if (!branches) return [];

  const resultado = await Promise.all(
    branches.map(async (branch) => {
      const { data: items } = await admin
        .from("inventory_items")
        .select("quantity")
        .eq("branch_id", branch.id);

      const total = (items ?? []).reduce((sum, i) => sum + (i.quantity ?? 0), 0);
      return { ...branch, total };
    })
  );

  return resultado;
}

export default async function StockSucursalesPage() {
  const sucursales = await getSucursalesConStock();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/almacen/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Inicio
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stock por sucursal</h1>
        <p className="text-sm text-gray-500 mt-1">Productos disponibles en cada sucursal</p>
      </div>

      <div className="space-y-3">
        {sucursales.map((s) => (
          <Link
            key={s.id}
            href={`/almacen/stock-sucursales/${s.id}`}
            className="flex items-center justify-between rounded-2xl bg-white border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900">📍 {s.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">Ver detalle de productos</p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${s.total < 10 ? "text-red-500" : "text-green-600"}`}>{s.total}</p>
              <p className="text-xs text-gray-400">piezas totales</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

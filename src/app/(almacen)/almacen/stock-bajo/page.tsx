import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

async function getStockBajo() {
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
        .select("quantity, products(id, name, min_weekly_quantity)")
        .eq("branch_id", branch.id)
        .lt("quantity", 5);

      const productosBajos = (items ?? []).filter((i) => {
        const product = Array.isArray(i.products) ? i.products[0] : i.products as { min_weekly_quantity: number } | null;
        return i.quantity <= (product?.min_weekly_quantity ?? 5);
      });

      return { ...branch, productos: productosBajos };
    })
  );

  return resultado.filter((b) => b.productos.length > 0);
}

export default async function StockBajoPage() {
  const sucursales = await getStockBajo();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/almacen/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Inicio
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stock bajo por sucursal</h1>
        <p className="text-sm text-gray-500 mt-1">
          {sucursales.length} sucursal{sucursales.length !== 1 ? "es" : ""} con productos por agotarse
        </p>
      </div>

      {sucursales.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-green-300 p-10 text-center">
          <p className="text-green-600 font-semibold text-sm">✅ Todas las sucursales tienen stock suficiente</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sucursales.map((s) => (
            <div key={s.id} className="rounded-2xl bg-white border border-red-200 p-5">
              <p className="text-sm font-bold text-gray-900 mb-3">📍 {s.name}</p>
              <div className="space-y-2">
                {s.productos.map((item, i) => {
                  const product = Array.isArray(item.products) ? item.products[0] : item.products as { id: string; name: string } | null;
                  return (
                    <Link
                      key={i}
                      href={`/almacen/inventario/${product?.id}`}
                      className="flex items-center justify-between rounded-xl bg-red-50 border border-red-100 px-4 py-3 hover:border-red-300 transition"
                    >
                      <p className="text-sm text-gray-800">{product?.name}</p>
                      <span className="text-sm font-bold text-red-600">{item.quantity} piezas</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

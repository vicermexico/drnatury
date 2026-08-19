import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import Image from "next/image";

async function getStats() {
  const admin = createAdminClient();

  const [products, branches, lowStock] = await Promise.all([
    admin.from("products").select("id", { count: "exact", head: true }).eq("is_active", true).is("deleted_at", null),
    admin.from("branches").select("id", { count: "exact", head: true }).eq("is_active", true).is("deleted_at", null),
    admin.from("inventory_items")
      .select("branch_id", { count: "exact", head: true })
      .lt("quantity", 5)
      .gt("quantity", 0),
  ]);

  return {
    products: products.count ?? 0,
    branches: branches.count ?? 0,
    lowStock: lowStock.count ?? 0,
  };
}

async function getProductsWithStock() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select("id, name, image_url, inventory_items(quantity)").is("inventory_items.branch_id", null)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");

  return (data ?? []).map((p) => {
    const stock = (p.inventory_items as { quantity: number }[] | null) ?? [];
    const total = stock.reduce((sum, s) => sum + (s.quantity ?? 0), 0);
    return { ...p, total };
  });
}

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

export default async function AlmacenDashboard() {
  const [stats, products, sucursales] = await Promise.all([getStats(), getProductsWithStock(), getSucursalesConStock()]);

  const now = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
    timeZone: "America/Monterrey",
  });

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Almacén</h1>
        <p className="text-sm text-gray-500 mt-1 capitalize">{now}</p>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/almacen/inventario"
          className="rounded-2xl bg-white border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition">
          <p className="text-3xl font-bold text-blue-600">{stats.products}</p>
          <p className="text-sm text-gray-500 mt-1">Productos dados de alta</p>
        </Link>

        <Link href="/almacen/sucursales"
          className="rounded-2xl bg-white border border-gray-200 p-5 hover:border-green-300 hover:shadow-sm transition">
          <p className="text-3xl font-bold text-green-600">{stats.branches}</p>
          <p className="text-sm text-gray-500 mt-1">Sucursales activas</p>
        </Link>

        <Link href="/almacen/stock-bajo"
          className="rounded-2xl bg-white border border-gray-200 p-5 hover:border-red-300 hover:shadow-sm transition col-span-2">
          <p className="text-3xl font-bold text-red-500">{stats.lowStock}</p>
          <p className="text-sm text-gray-500 mt-1">Sucursales con stock bajo</p>
        </Link>
      </div>

      {/* Stock por sucursal */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Stock por sucursal
        </h2>
        <div className="space-y-2">
          {sucursales.map((s) => (
            <Link key={s.id} href={`/almacen/stock-sucursales/${s.id}`}
              className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition">
              <p className="text-sm font-medium text-gray-900">📍 {s.name}</p>
              <div className="text-right">
                <p className={`text-xl font-bold ${s.total < 5 ? "text-red-500" : "text-green-600"}`}>{s.total}</p>
                <p className="text-xs text-gray-400">piezas</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Productos con foto y piezas */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Productos en almacén
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => (
            <Link key={p.id} href={`/almacen/inventario/${p.id}`}
              className="flex items-center gap-3 rounded-xl bg-white border border-gray-200 px-4 py-3 hover:border-blue-300 hover:shadow-sm transition">
              {p.image_url ? (
                <Image src={p.image_url} alt={p.name} width={40} height={40}
                  className="rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="text-lg">📦</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                <p className={`text-xs font-semibold mt-0.5 ${p.total < 5 ? "text-red-500" : "text-green-600"}`}>
                  {p.total} piezas
                </p>
              </div>
            </Link>
          ))}
          {products.length === 0 && (
            <p className="text-sm text-gray-400 col-span-2 text-center py-6">Sin productos registrados</p>
          )}
        </div>
      </div>
    </div>
  );
}

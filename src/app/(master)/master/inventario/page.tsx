import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { InventarioTable } from "./InventarioTable";

async function getInventarioGeneral() {
  const admin = createAdminClient();
  const today = new Date();
  const cst = new Date(today.toLocaleString("en-US", { timeZone: "America/Monterrey" }));
  const todayStart = new Date(Date.UTC(cst.getFullYear(), cst.getMonth(), cst.getDate(), 6, 0, 0));
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);
  const monthStart = new Date(Date.UTC(cst.getFullYear(), cst.getMonth(), 1, 6, 0, 0));

  const [productsRes, itemsRes, branchesRes, ventasHoyRes, ventasMesRes] = await Promise.all([
    admin.from("products")
      .select("id, name, image_url, min_weekly_quantity")
      .is("deleted_at", null).eq("is_active", true).order("name"),
    admin.from("inventory_items")
      .select("product_id, quantity, is_warehouse, branch_id"),
    admin.from("branches")
      .select("id, name").eq("is_active", true).is("deleted_at", null).order("name"),
    admin.from("inventory_movements")
      .select("product_id, quantity_before, quantity_after, branch_id")
      .eq("type", "VENTA")
      .gte("performed_at", todayStart.toISOString())
      .lt("performed_at", todayEnd.toISOString()),
    admin.from("inventory_movements")
      .select("product_id, quantity_before, quantity_after, branch_id")
      .eq("type", "VENTA")
      .gte("performed_at", monthStart.toISOString())
      .lt("performed_at", todayEnd.toISOString()),
  ]);

  return {
    products:  productsRes.data ?? [],
    items:     itemsRes.data ?? [],
    branches:  branchesRes.data ?? [],
    ventasHoy: ventasHoyRes.data ?? [],
    ventasMes: ventasMesRes.data ?? [],
  };
}

export default async function MasterInventarioPage() {
  const { products, items, branches, ventasHoy, ventasMes } = await getInventarioGeneral();

  const stockByProduct: Record<string, {
    warehouse: number;
    branches: Record<string, number>;
    soldToday: number;
    soldTodayByBranch: Record<string, number>;
    soldTodayWarehouse: number;
    soldMonth: number;
    soldMonthByBranch: Record<string, number>;
    soldMonthWarehouse: number;
  }> = {};

  for (const p of products) {
    stockByProduct[p.id] = {
      warehouse: 0, branches: {},
      soldToday: 0, soldTodayByBranch: {}, soldTodayWarehouse: 0,
      soldMonth: 0, soldMonthByBranch: {}, soldMonthWarehouse: 0,
    };
  }

  for (const item of items) {
    const entry = stockByProduct[item.product_id];
    if (!entry) continue;
    if (item.is_warehouse) {
      entry.warehouse = item.quantity;
    } else if (item.branch_id) {
      entry.branches[item.branch_id] = item.quantity;
    }
  }

  for (const v of ventasHoy) {
    const entry = stockByProduct[v.product_id];
    if (!entry) continue;
    const sold = (v.quantity_before ?? 0) - (v.quantity_after ?? 0);
    entry.soldToday += sold;
    if (v.branch_id) {
      entry.soldTodayByBranch[v.branch_id] = (entry.soldTodayByBranch[v.branch_id] ?? 0) + sold;
    } else {
      entry.soldTodayWarehouse += sold;
    }
  }

  for (const v of ventasMes) {
    const entry = stockByProduct[v.product_id];
    if (!entry) continue;
    const sold = (v.quantity_before ?? 0) - (v.quantity_after ?? 0);
    entry.soldMonth += sold;
    if (v.branch_id) {
      entry.soldMonthByBranch[v.branch_id] = (entry.soldMonthByBranch[v.branch_id] ?? 0) + sold;
    } else {
      entry.soldMonthWarehouse += sold;
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario general</h1>
          <p className="text-sm text-gray-500 mt-0.5">{products.length} productos</p>
        </div>
        <Link href="/master/inventario/nuevo"
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition">
          + Nuevo producto
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 text-sm mb-3">No hay productos en el catalogo</p>
          <Link href="/master/inventario/nuevo" className="text-blue-600 text-sm underline">
            Crear el primer producto
          </Link>
        </div>
      ) : (
        <InventarioTable products={products} branches={branches} stockByProduct={stockByProduct} />
      )}
    </div>
  );
}
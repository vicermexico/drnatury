import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerProfile } from "@/lib/auth";

async function getProductos() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select("id, name, description, min_weekly_quantity, is_active, image_url, inventory_items(quantity, is_warehouse)")
    .is("deleted_at", null)
    .order("name");
  return data ?? [];
}

type ProductRow = Awaited<ReturnType<typeof getProductos>>[number];

function getStock(p: ProductRow): number {
  const items = Array.isArray(p.inventory_items) ? p.inventory_items : p.inventory_items ? [p.inventory_items] : [];
  const warehouseItem = items.find((i: { quantity: number; is_warehouse?: boolean }) => i.is_warehouse === true);
  return warehouseItem?.quantity ?? 0;
}

function isLowStock(p: ProductRow): boolean {
  return getStock(p) <= p.min_weekly_quantity;
}

export default async function InventarioPage() {
  const [products, profile] = await Promise.all([getProductos(), getServerProfile()]);
  const lowStock = products.filter(isLowStock);
  const isMaster = (profile?.roles as string[] | undefined)?.includes("MASTER") ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {products.length} producto{products.length !== 1 ? "s" : ""} en catÃ¡logo
          </p>
        </div>
        {isMaster && (
          <Link
            href="/almacen/inventario/nuevo"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            + Nuevo producto
          </Link>
        )}
      </div>

      {/* Alerta de stock bajo */}
      {lowStock.length > 0 && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-semibold text-red-700 mb-2">
            âš ï¸ {lowStock.length} producto{lowStock.length !== 1 ? "s" : ""} con stock bajo
          </p>
          <div className="space-y-1">
            {lowStock.map(p => (
              <Link
                key={p.id}
                href={`/almacen/inventario/${p.id}`}
                className="flex items-center justify-between text-sm text-red-600 hover:text-red-800 transition"
              >
                <span>{p.name}</span>
                <span className="font-semibold">{getStock(p)} uds.</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Lista de productos */}
      {products.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 text-sm">No hay productos en el catÃ¡logo</p>
          {isMaster && (
            <Link href="/almacen/inventario/nuevo" className="text-blue-600 text-sm underline mt-3 inline-block">
              Agregar el primer producto
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {products.map(p => {
            const qty = getStock(p);
            const low = isLowStock(p);
            return (
              <Link
                key={p.id}
                href={`/almacen/inventario/${p.id}`}
                className="flex items-center justify-between rounded-2xl bg-white border border-gray-200 px-4 py-4 hover:border-blue-400 hover:shadow-sm transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {p.image_url ? (
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-gray-100">
                      <Image src={p.image_url} alt={p.name} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center text-xl">ðŸ“¦</div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                    {p.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{p.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <div className="text-right">
                    <span className={`text-lg font-bold ${low ? "text-red-600" : "text-gray-900"}`}>{qty}</span>
                    {low && (
                      <p className="text-[10px] text-red-500 font-semibold">STOCK BAJO</p>
                    )}
                  </div>
                  <span className="text-gray-300 text-lg">â€º</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}



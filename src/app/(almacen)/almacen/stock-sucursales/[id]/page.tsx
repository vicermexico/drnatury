import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";

async function getSucursalStock(id: string) {
  const admin = createAdminClient();

  const [branchRes, itemsRes] = await Promise.all([
    admin.from("branches").select("id, name").eq("id", id).single(),
    admin.from("inventory_items")
      .select("quantity, products(id, name, image_url)")
      .eq("branch_id", id)
      .order("quantity", { ascending: true }),
  ]);

  if (!branchRes.data) return null;

  return {
    branch: branchRes.data,
    items: itemsRes.data ?? [],
  };
}

export default async function StockSucursalDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSucursalStock(id);
  if (!data) notFound();

  const { branch, items } = data;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/almacen/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Inicio
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{branch.name}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {items.length} producto{items.length !== 1 ? "s" : ""} en esta sucursal
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-400 text-sm">No hay productos en esta sucursal</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => {
            const product = Array.isArray(item.products) ? item.products[0] : item.products as { id: string; name: string } | null;
            return (
              <div key={i}
                className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-5 py-4">
                <p className="text-sm font-medium text-gray-900">{product?.name ?? "Producto"}</p>
                <span className={`text-lg font-bold ${item.quantity < 5 ? "text-red-500" : "text-green-600"}`}>
                  {item.quantity} piezas
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
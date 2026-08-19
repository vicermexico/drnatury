import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductoActions } from "./ProductoActions";

async function getProducto(id: string) {
  const admin = createAdminClient();
  const [productRes, itemsRes, branchesRes, movementsRes] = await Promise.all([
    admin.from("products")
      .select("id, name, description, min_weekly_quantity, is_active, image_url")
      .eq("id", id).is("deleted_at", null).maybeSingle(),
    admin.from("inventory_items")
      .select("quantity, is_warehouse, branch_id")
      .eq("product_id", id),
    admin.from("branches")
      .select("id, name").eq("is_active", true).is("deleted_at", null).order("name"),
    admin.from("inventory_movements")
      .select("id, type, quantity_before, quantity_after, notes, performed_at, branch_id, performer:profiles!performed_by(name), branch:branches!branch_id(name)")
      .eq("product_id", id)
      .order("performed_at", { ascending: false })
      .limit(50),
  ]);
  if (!productRes.data) return null;
  return { product: productRes.data, items: itemsRes.data ?? [], branches: branchesRes.data ?? [], movements: movementsRes.data ?? [] };
}

export default async function MasterProductoDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getProducto(id);
  if (!data) notFound();

  const { product, items, branches, movements } = data;

  const TYPE_LABEL: Record<string, string> = {
    ENTRADA_PROVEEDOR: "Entrada de proveedor",
    VENTA: "Venta en sucursal",
    SURTIDO_ALMACEN: "Salida a sucursal",
    RECIBO_SUCURSAL: "Recibo en sucursal",
    VENTA: "Venta",
  };
  const TYPE_COLOR: Record<string, string> = {
    ENTRADA_PROVEEDOR: "text-green-700 bg-green-50",
    VENTA: "text-red-700 bg-red-50",
    SURTIDO_ALMACEN: "text-blue-700 bg-blue-50",
    RECIBO_SUCURSAL: "text-purple-700 bg-purple-50",
  };
  const warehouseItem = items.find(i => i.is_warehouse);
  const warehouseQty  = warehouseItem?.quantity ?? 0;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm mb-3">
          <Link href="/master/inventario" className="text-gray-400 hover:text-gray-600">Inventario</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">{product.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
          {!product.is_active && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">Inactivo</span>
          )}
        </div>
      </div>

      {product.image_url && (
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
          <Image src={product.image_url} alt={product.name} fill className="object-contain" />
        </div>
      )}

      {/* Stock por ubicaciÃ³n */}
      <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Stock por ubicaciÃ³n</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">AlmacÃ©n central</span>
            <span className="font-semibold text-gray-900">{warehouseQty}</span>
          </div>
          {branches.map(b => {
            const branchItem = items.find(i => !i.is_warehouse && i.branch_id === b.id);
            return (
              <div key={b.id} className="flex justify-between">
                <span className="text-gray-500">{b.name}</span>
                <span className="font-semibold text-gray-900">{branchItem?.quantity ?? 0}</span>
              </div>
            );
          })}
          <div className="flex justify-between pt-2 border-t border-gray-100">
            <span className="font-medium text-gray-700">Total</span>
            <span className="font-bold text-gray-900">
              {warehouseQty + branches.reduce((s, b) => s + (items.find(i => !i.is_warehouse && i.branch_id === b.id)?.quantity ?? 0), 0)}
            </span>
          </div>
        </div>
        {product.description && (
          <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">{product.description}</p>
        )}
        <p className="text-xs text-gray-400">Stock mÃ­nimo semanal: {product.min_weekly_quantity}</p>
      </section>

      {/* Historial de movimientos */}
      {movements.length > 0 && (
        <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Historial</h2>
          <div className="space-y-3">
            {movements.map((m) => {
              const delta = (m.quantity_after ?? 0) - (m.quantity_before ?? 0);
              const performer = Array.isArray(m.performer) ? m.performer[0] : m.performer as { name: string } | null;
              const branch = Array.isArray(m.branch) ? m.branch[0] : m.branch as { name: string } | null;
              return (
                <div key={m.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={["text-xs px-2 py-0.5 rounded-full font-medium", TYPE_COLOR[m.type] ?? "text-gray-600 bg-gray-50"].join(" ")}>
                        {TYPE_LABEL[m.type] ?? m.type}
                      </span>
                      {branch?.name && <span className="text-xs text-gray-400">{branch.name}</span>}
                    </div>
                    {m.notes && <p className="text-xs text-gray-400">{m.notes}</p>}
                    <p className="text-xs text-gray-400">
                      {new Date(m.performed_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Monterrey" })}
                      {performer?.name && ` · ${performer.name}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={["text-sm font-bold", delta >= 0 ? "text-green-600" : "text-red-600"].join(" ")}>
                      {delta >= 0 ? "+" : ""}{delta}
                    </p>
                    <p className="text-xs text-gray-400">{m.quantity_before} → {m.quantity_after}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <ProductoActions
        producto={{
          id:                  product.id,
          name:                product.name,
          description:         product.description ?? null,
          min_weekly_quantity: product.min_weekly_quantity,
          is_active:           product.is_active,
          image_url:           product.image_url as string | null ?? null,
        }}
      />
    </div>
  );
}





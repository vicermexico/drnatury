import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { MovimientoForm } from "@/components/almacen/MovimientoForm";
import type { InventoryMovementType } from "@/types";

async function getProducto(id: string) {
  const admin = createAdminClient();
  const [productRes, movementsRes, branchesRes] = await Promise.all([
    admin.from("products")
      .select("id, name, description, min_weekly_quantity, image_url, inventory_items!inner(quantity, is_warehouse)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    admin.from("inventory_movements")
      .select("id, type, quantity_before, quantity_after, notes, performed_at, performer:profiles!performed_by(name)")
      .eq("product_id", id)
      .in("type", ["ENTRADA_PROVEEDOR", "SURTIDO_ALMACEN", "VENTA"])
      .or("branch_id.is.null,type.neq.VENTA")
      .order("performed_at", { ascending: false })
      .limit(20),
    admin.from("branches")
      .select("id, name")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
  ]);
  if (!productRes.data) return null;
  return { product: productRes.data, movements: movementsRes.data ?? [], branches: branchesRes.data ?? [] };
}

const TYPE_LABEL: Partial<Record<InventoryMovementType, string>> = {
  ENTRADA_PROVEEDOR: "Entrada de proveedor",
  SURTIDO_ALMACEN:   "Salida a sucursal",
  VENTA:             "Venta directa",
};

const TYPE_COLOR: Partial<Record<InventoryMovementType, string>> = {
  ENTRADA_PROVEEDOR: "text-green-700 bg-green-50",
  SURTIDO_ALMACEN:   "text-blue-700 bg-blue-50",
  VENTA:             "text-red-700 bg-red-50",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Monterrey",
  });
}

export default async function AlmacenProductoDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getProducto(id);
  if (!data) notFound();
  const { product, movements, branches } = data;

  const items = product.inventory_items as unknown as { quantity: number; is_warehouse: boolean }[];
  const warehouseItem = items.find(i => i.is_warehouse);
  const warehouseQty  = warehouseItem?.quantity ?? 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/almacen/inventario" className="text-sm text-gray-400 hover:text-gray-600">
          &larr; Inventario
        </Link>
      </div>

      <div className="flex items-start gap-4">
        {product.image_url ? (
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-gray-100">
            <Image src={product.image_url} alt={product.name} fill className="object-cover" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-gray-100 shrink-0 flex items-center justify-center text-2xl">📦</div>
        )}
        <div>
          <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
          {product.description && <p className="text-sm text-gray-500 mt-0.5">{product.description}</p>}
          <p className="text-2xl font-bold text-blue-600 mt-1">{warehouseQty} <span className="text-sm font-normal text-gray-400">en almacen</span></p>
        </div>
      </div>

      <MovimientoForm productId={product.id} branches={branches} />

      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Historial del almacen</h2>
        {movements.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Sin movimientos registrados</p>
        ) : (
          <div className="space-y-2">
            {movements.map(m => {
              const type = m.type as InventoryMovementType;
              const delta = m.quantity_after - m.quantity_before;
              const performer = Array.isArray(m.performer) ? m.performer[0] : m.performer as { name: string } | null;
              return (
                <div key={m.id} className="rounded-2xl bg-white border border-gray-200 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TYPE_COLOR[type] ?? "text-gray-700 bg-gray-100"}`}>
                      {TYPE_LABEL[type] ?? type}
                    </span>
                    <span className={`text-sm font-bold ${delta > 0 ? "text-green-600" : "text-red-600"}`}>
                      {delta > 0 ? "+" : ""}{delta}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {m.quantity_before} &rarr; {m.quantity_after}
                    {m.notes ? <span className="text-gray-400"> · {m.notes}</span> : null}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(m.performed_at as string)}</p>
                  {performer && <p className="text-xs font-medium text-gray-600">{performer.name}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
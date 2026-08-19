import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { MovimientoTerapeutaForm } from "@/components/almacen/MovimientoTerapeutaForm";
import { PendingShipments } from "@/components/almacen/PendingShipments";
import type { InventoryMovementType } from "@/types";

async function getProducto(id: string, branchId: string) {
  const admin = createAdminClient();
  const [productRes, itemRes, movementsRes] = await Promise.all([
    admin.from("products")
      .select("id, name, description, min_weekly_quantity, image_url")
      .eq("id", id).is("deleted_at", null).maybeSingle(),
    admin.from("inventory_items")
      .select("quantity")
      .eq("product_id", id)
      .eq("is_warehouse", false)
      .eq("branch_id", branchId)
      .maybeSingle(),
    admin.from("inventory_movements")
      .select("id, type, quantity_before, quantity_after, notes, performed_at, patient_phone, performer:profiles!performed_by(name)")
      .eq("product_id", id)
      .eq("branch_id", branchId)
      .in("type", ["RECIBO_SUCURSAL", "VENTA"])
      .order("performed_at", { ascending: false })
      .limit(20),
  ]);
  if (!productRes.data) return null;
  return {
    product:   productRes.data,
    quantity:  itemRes.data?.quantity ?? 0,
    movements: movementsRes.data ?? [],
  };
}

const TYPE_LABEL: Partial<Record<InventoryMovementType, string>> = {
  RECIBO_SUCURSAL: "Entrada de almacén",
  VENTA:           "Salida a paciente",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Monterrey",
  });
}

export default async function TerapeutaInventarioDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const therapist = await requireRole("TERAPEUTA");
  if (!therapist.branch_id) notFound();

  const data = await getProducto(id, therapist.branch_id);
  if (!data) notFound();

  const { product, quantity, movements } = data;
  const isLow = quantity <= product.min_weekly_quantity;

  // Solo mostrar movimientos relevantes para esta sucursal (RECIBO_SUCURSAL y VENTA)
  const branchMovements = movements.filter(m =>
    m.type === "RECIBO_SUCURSAL" || m.type === "VENTA"
  );

  return (
    <div className="space-y-5">
      <div>
        <Link href="/terapeuta/inventario" className="text-sm text-gray-400 hover:text-gray-600">
          ← Inventario
        </Link>
      </div>

      <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>

      {product.image_url && (
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
          <Image src={product.image_url} alt={product.name} fill className="object-contain" />
        </div>
      )}

      {/* Stock en sucursal */}
      <section className={`rounded-2xl border p-5 ${isLow ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-1 text-gray-500">Stock en tu sucursal</p>
        <div className="flex items-baseline gap-3">
          <span className={`text-4xl font-bold ${isLow ? "text-red-700" : "text-green-700"}`}>{quantity}</span>
          <span className="text-sm text-gray-500">unidades</span>
          {isLow && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
              ⚠️ Stock bajo — mínimo {product.min_weekly_quantity}
            </span>
          )}
        </div>
      </section>

      {/* Entradas: envíos pendientes de este producto */}
      <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          ＋ Entradas pendientes de recibir
        </h2>
        <PendingShipments productId={product.id} />
      </section>

      {/* Salidas a paciente */}
      <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          － Registrar salida a paciente
        </h2>
        <MovimientoTerapeutaForm productId={product.id} currentStock={quantity} />
      </section>

      {/* Historial */}
      {branchMovements.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Historial reciente</h2>
          <div className="space-y-2">
            {branchMovements.map(m => {
              const delta     = m.quantity_after - m.quantity_before;
              const performer = Array.isArray(m.performer) ? m.performer[0] : m.performer as { name: string } | null;
              return (
                <div key={m.id} className="flex items-start justify-between rounded-xl bg-white border border-gray-200 px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        delta > 0 ? "text-green-700 bg-green-50" : "text-orange-700 bg-orange-50"
                      }`}>
                        {TYPE_LABEL[m.type as InventoryMovementType] ?? m.type}
                      </span>
                      <span className={`text-sm font-bold ${delta > 0 ? "text-green-700" : "text-orange-600"}`}>
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {m.quantity_before} → {m.quantity_after}
                      {m.patient_phone && <span className="ml-2 text-blue-600">paciente: {m.patient_phone}</span>}
                      {m.notes && <span className="ml-2 text-gray-500">· {m.notes}</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">{formatDate(m.performed_at as string)}</p>
                    {performer?.name && <p className="text-xs text-gray-500">{performer.name}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

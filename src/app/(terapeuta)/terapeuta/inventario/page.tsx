import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { PendingShipments } from "@/components/almacen/PendingShipments";

export const dynamic = "force-dynamic";

interface MercanciaRow { nombre: string; cantidad: number; celular: string; pedido_id: string; separado_at: string; tipo: string; }

async function getMercanciaSeparada(branchId: string): Promise<MercanciaRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pedidos_biored")
    .select("pedido_id, productos, usuario_celular, separado_at, tipo")
    .eq("sucursal_id", branchId)
    .eq("separado", true)
    .eq("estado", "pendiente")
    .order("separado_at", { ascending: true });

  const rows: MercanciaRow[] = [];
  for (const p of data ?? []) {
    const prods = p.productos as { nombre: string; cantidad: number }[];
    for (const prod of prods) {
      rows.push({
        nombre:      prod.nombre,
        cantidad:    prod.cantidad,
        celular:     p.usuario_celular,
        pedido_id:   p.pedido_id,
        separado_at: p.separado_at,
        tipo:        p.tipo,
      });
    }
  }
  return rows;
}

async function getInventarioSucursal(branchId: string) {
  const admin = createAdminClient();
  const [productsRes, itemsRes] = await Promise.all([
    admin.from("products")
      .select("id, name, image_url, min_weekly_quantity")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    admin.from("inventory_items")
      .select("product_id, quantity")
      .eq("is_warehouse", false)
      .eq("branch_id", branchId),
  ]);

  const stockMap = new Map(
    (itemsRes.data ?? []).map(i => [i.product_id, i.quantity])
  );

  return (productsRes.data ?? []).map(p => ({
    ...p,
    quantity: stockMap.get(p.id) ?? 0,
  }));
}

export default async function TerapeutaInventarioPage() {
  const therapist = await requireRole("TERAPEUTA");

  if (!therapist.branch_id) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Inventario</h1>
        <div className="rounded-2xl bg-yellow-50 border border-yellow-200 p-5 text-sm text-yellow-800">
          No tienes una sucursal asignada. Contacta al administrador.
        </div>
      </div>
    );
  }

  const [products, mercanciaSeparada] = await Promise.all([
    getInventarioSucursal(therapist.branch_id),
    getMercanciaSeparada(therapist.branch_id),
  ]);
  const lowStock = products.filter(p => p.quantity <= p.min_weekly_quantity);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Inventario</h1>
        <p className="text-sm text-gray-500 mt-0.5">Stock en tu sucursal</p>
      </div>

      {/* Envíos pendientes de recibir */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">📬 Envíos pendientes de recibir</h2>
        <PendingShipments />
      </section>

      {/* Mercancía separada BIORED */}
      {mercanciaSeparada.filter(r => r.tipo === "biored").length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">📦 Mercancía separada BIORED</h2>
          <div className="rounded-2xl bg-yellow-50 border border-yellow-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-yellow-200">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-yellow-800">Producto</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-yellow-800">Cant.</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-yellow-800">Cliente</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-yellow-800">Pedido #</th>
                </tr>
              </thead>
              <tbody>
                {mercanciaSeparada.filter(r => r.tipo === "biored").map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? "" : "bg-yellow-100/50"}>
                    <td className="px-4 py-2.5 text-yellow-900 font-medium">{r.nombre}</td>
                    <td className="px-3 py-2.5 text-center text-yellow-800">{r.cantidad}</td>
                    <td className="px-3 py-2.5 text-yellow-800">{r.celular}</td>
                    <td className="px-3 py-2.5 text-yellow-700 font-mono text-xs">{r.pedido_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Mercancía separada BioTokens */}
      {mercanciaSeparada.filter(r => r.tipo === "biotokens").length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">📦 Mercancía separada BioTokens</h2>
          <div className="rounded-2xl bg-yellow-100 border border-yellow-300 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-yellow-300">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-yellow-900">Producto</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-yellow-900">Cant.</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-yellow-900">Cliente</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-yellow-900">Pedido #</th>
                </tr>
              </thead>
              <tbody>
                {mercanciaSeparada.filter(r => r.tipo === "biotokens").map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? "" : "bg-yellow-200/50"}>
                    <td className="px-4 py-2.5 text-yellow-900 font-medium">{r.nombre}</td>
                    <td className="px-3 py-2.5 text-center text-yellow-800">{r.cantidad}</td>
                    <td className="px-3 py-2.5 text-yellow-800">{r.celular}</td>
                    <td className="px-3 py-2.5 text-yellow-700 font-mono text-xs">{r.pedido_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {lowStock.length > 0 && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-semibold text-red-700 mb-2">
            ⚠️ {lowStock.length} producto{lowStock.length !== 1 ? "s" : ""} con stock bajo
          </p>
          <div className="space-y-1">
            {lowStock.map(p => (
              <Link key={p.id} href={`/terapeuta/inventario/${p.id}`}
                className="flex items-center justify-between text-sm text-red-600 hover:text-red-800 transition">
                <span>{p.name}</span>
                <span className="font-semibold">{p.quantity} uds.</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 text-sm">No hay productos en el catálogo</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map(p => {
            const low = p.quantity <= p.min_weekly_quantity;
            return (
              <Link key={p.id} href={`/terapeuta/inventario/${p.id}`}
                className="flex items-center justify-between rounded-2xl bg-white border border-gray-200 px-4 py-3.5 hover:border-blue-300 hover:shadow-sm transition">
                <div className="flex items-center gap-3">
                  {p.image_url ? (
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                      <Image src={p.image_url} alt={p.name} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-lg">📦</div>
                  )}
                  <span className="text-sm font-medium text-gray-900">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${low ? "text-red-600" : "text-gray-900"}`}>
                    {p.quantity}
                  </span>
                  {low && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">BAJO</span>}
                  <span className="text-gray-300 text-sm">›</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { PedidosBioredList } from "./PedidosBioredList";

export const dynamic = "force-dynamic";

export interface InventarioFaltante { nombre: string; necesita: number; tiene: number; }
export interface InventarioStatus   { ok: boolean; faltantes: InventarioFaltante[]; }

async function getPedidos(sucursalId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pedidos_biored")
    .select("id, pedido_id, usuario_nombre, usuario_celular, productos, total, total_tokens, tipo, nip_entrega, estado, separado, separado_at, created_at, terapeuta_nombre, entregado_at")
    .eq("sucursal_id", sucursalId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function getInventarioStatus(
  sucursalId: string,
  pedidos: Awaited<ReturnType<typeof getPedidos>>
): Promise<Record<string, InventarioStatus>> {
  const admin = createAdminClient();
  const { data: items } = await admin
    .from("inventory_items")
    .select("product_id, quantity, products(name)")
    .eq("branch_id", sucursalId)
    .eq("is_warehouse", false);

  const stockById: Record<string, number> = {};
  const stockByName: Record<string, number> = {};
  for (const item of items ?? []) {
    const prod = item.products as unknown as { name: string } | null;
    if (item.product_id) stockById[item.product_id] = item.quantity;
    if (prod?.name) stockByName[prod.name.toLowerCase()] = item.quantity;
  }

  const result: Record<string, InventarioStatus> = {};
  for (const pedido of pedidos) {
    if (pedido.estado !== "pendiente") continue;
    if (pedido.separado) { result[pedido.id] = { ok: true, faltantes: [] }; continue; }
    const productos = pedido.productos as { nombre: string; cantidad: number; product_id?: string | null }[];
    const faltantes: InventarioFaltante[] = [];
    for (const p of productos) {
      const tiene = p.product_id
        ? (stockById[p.product_id] ?? 0)
        : (stockByName[p.nombre.toLowerCase()] ?? 0);
      if (tiene < p.cantidad) faltantes.push({ nombre: p.nombre, necesita: p.cantidad, tiene });
    }
    result[pedido.id] = { ok: faltantes.length === 0, faltantes };
  }
  return result;
}

export default async function PedidosBioredPage() {
  const profile = await requireRole("TERAPEUTA");
  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("profiles")
    .select("branch_id, name")
    .eq("id", profile.id)
    .single();

  if (!perfil?.branch_id) {
    return (
      <div className="p-6 text-center text-gray-500 text-sm">
        No tienes sucursal asignada.
      </div>
    );
  }

  const pedidos = await getPedidos(perfil.branch_id);
  const inventarioStatus = await getInventarioStatus(perfil.branch_id, pedidos);

  const pendientes = pedidos.filter(p => p.estado === "pendiente").length;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pedidos BIORED</h1>
        <p className="text-sm text-gray-500 mt-1">
          {pendientes} pedido{pendientes !== 1 ? "s" : ""} pendiente{pendientes !== 1 ? "s" : ""}
        </p>
      </div>
      <PedidosBioredList
        pedidos={pedidos}
        inventarioStatus={inventarioStatus}
        terapeutaNombre={perfil.name ?? ""}
      />
    </div>
  );
}

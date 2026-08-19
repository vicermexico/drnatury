import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("TERAPEUTA");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: pedido } = await admin
    .from("pedidos_biored")
    .select("id, pedido_id, sucursal_id, productos, usuario_celular, estado, separado")
    .eq("id", id)
    .eq("estado", "pendiente")
    .eq("separado", false)
    .maybeSingle();

  if (!pedido) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Pedido no encontrado, ya entregado o ya separado" },
      { status: 404 }
    );
  }

  const productos = pedido.productos as { nombre: string; cantidad: number; product_id?: string | null }[];

  for (const prod of productos) {
    let resolvedProductId: string | null = null;
    let item: { id: string; quantity: number } | null = null;

    if (prod.product_id) {
      resolvedProductId = prod.product_id;
      const { data } = await admin
        .from("inventory_items")
        .select("id, quantity")
        .eq("product_id", prod.product_id)
        .eq("branch_id", pedido.sucursal_id)
        .eq("is_warehouse", false)
        .maybeSingle();
      item = data;
    } else {
      const { data: product } = await admin
        .from("products")
        .select("id")
        .ilike("name", prod.nombre)
        .maybeSingle();
      if (product) {
        resolvedProductId = product.id;
        const { data } = await admin
          .from("inventory_items")
          .select("id, quantity")
          .eq("product_id", product.id)
          .eq("branch_id", pedido.sucursal_id)
          .eq("is_warehouse", false)
          .maybeSingle();
        item = data;
      }
    }

    if (!item || !resolvedProductId) continue;

    const newQty = Math.max(0, item.quantity - prod.cantidad);

    await admin.from("inventory_items")
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", item.id);

    await admin.from("inventory_movements").insert({
      product_id:      resolvedProductId,
      type:            "VENTA",
      quantity_before: item.quantity,
      quantity_after:  newQty,
      branch_id:       pedido.sucursal_id,
      notes:           `Mercancía separada - Pedido BIORED #${pedido.pedido_id} - Cliente: ${pedido.usuario_celular}`,
      patient_phone:   pedido.usuario_celular,
    });
  }

  await admin.from("pedidos_biored")
    .update({ separado: true, separado_at: new Date().toISOString() })
    .eq("id", id);

  console.log('[separar] pedido_id:', pedido.pedido_id, 'URL:', `https://www.drbiored.com/api/pedidos/${pedido.pedido_id}`);
  const patchRes = await fetch(`https://www.drbiored.com/api/pedidos/${pedido.pedido_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado: "separado" }),
  }).catch(e => { console.error('[separar] Error PATCH BIORED:', e); return null; });

  if (patchRes) {
    const patchData = await patchRes.text();
    console.log('[separar] PATCH BIORED status:', patchRes.status, 'body:', patchData);
  }

  return NextResponse.json({ success: true });
}

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, userId } = await guardRole("TERAPEUTA");
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { nip?: string };

  if (!body.nip) {
    return NextResponse.json({ error: "MISSING_NIP" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: terapeutaPerfil } = await admin
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .single();
  const terapeutaNombre = terapeutaPerfil?.name ?? "";

  // Obtener pedido
  const { data: pedido } = await admin
    .from("pedidos_biored")
    .select("id, pedido_id, nip_entrega, sucursal_id, productos, usuario_celular, estado, separado, tipo")
    .eq("id", id)
    .eq("estado", "pendiente")
    .maybeSingle();

  if (!pedido) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Pedido no encontrado o ya entregado" }, { status: 404 });
  }

  if (pedido.nip_entrega !== body.nip) {
    return NextResponse.json({ error: "NIP_INCORRECTO", message: "NIP incorrecto" }, { status: 400 });
  }

  // Siempre registra movement; solo descuenta quantity si aún no se separó
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

    const newQty = pedido.separado
      ? item.quantity
      : Math.max(0, item.quantity - prod.cantidad);

    const qtyBefore = pedido.separado
      ? item.quantity + prod.cantidad
      : item.quantity;

    if (!pedido.separado) {
      await admin.from("inventory_items")
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq("id", item.id);
    }

    const { error: mvError } = await admin.from("inventory_movements").insert({
      product_id:      resolvedProductId,
      type:            "VENTA",
      quantity_before: qtyBefore,
      quantity_after:  newQty,
      branch_id:       pedido.sucursal_id,
      notes:           `Salida a cliente ${pedido.tipo === "biotokens" ? "BioTokens" : "BIORED"} ${pedido.usuario_celular} pedido #${pedido.pedido_id}`,
      patient_phone:   pedido.usuario_celular,
      performed_by:    userId,
    });
    if (mvError) console.error('[entregar] inventory_movements error:', mvError);
  }

  // Marcar pedido como entregado
  await admin.from("pedidos_biored")
    .update({
      estado:           "entregado",
      terapeuta_nombre: terapeutaNombre,
      entregado_at:     new Date().toISOString(),
    })
    .eq("id", id);

  console.log('[entregar] pedido_id:', pedido.pedido_id, 'URL:', `https://www.drbiored.com/api/pedidos/${pedido.pedido_id}`);
  const patchRes = await Promise.race([
    fetch(`https://www.drbiored.com/api/pedidos/${pedido.pedido_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "entregado" }),
    }).catch((e: unknown) => { console.error('[entregar] Error PATCH BIORED:', e); return null; }),
    new Promise<null>(resolve => setTimeout(() => resolve(null), 3000)),
  ]);

  if (patchRes) {
    const patchData = await patchRes.text();
    console.log('[entregar] PATCH BIORED status:', patchRes.status, 'body:', patchData);
  }

  // Generar comisiones — solo pedidos biored, no bloquea si falla
  if (pedido.tipo === "biored") {
    try {
      // Terapeutas asignadas a la sucursal
      const { data: terapeutas } = await admin
        .from("profiles")
        .select("id")
        .eq("branch_id", pedido.sucursal_id)
        .contains("roles", ["TERAPEUTA"])
        .is("deleted_at", null);
      const numTerapeutas = terapeutas?.length ?? 0;

      // Asistentes globales con config de comisión
      const { data: configAsis } = await admin
        .from("comisiones_config_producto_asistente")
        .select("asistente_id, monto, product_id");

      const comisionesInsert: {
        pedido_biored_id: string;
        persona_id:       string;
        tipo_persona:     string;
        sucursal_id:      string;
        monto:            number;
      }[] = [];

      for (const prod of productos) {
        // Resolver product_id si no viene en el producto
        let productId = prod.product_id ?? null;
        if (!productId) {
          const { data: found } = await admin
            .from("products")
            .select("id")
            .ilike("name", prod.nombre)
            .maybeSingle();
          productId = found?.id ?? null;
        }
        if (!productId) continue;

        // Comisión terapeutas: busca monto por sucursal
        if (numTerapeutas > 0) {
          const { data: cfgSuc } = await admin
            .from("comisiones_config_producto_sucursal")
            .select("monto")
            .eq("product_id", productId)
            .eq("sucursal_id", pedido.sucursal_id)
            .maybeSingle();
          const montoSuc = cfgSuc?.monto ?? 0;
          if (montoSuc > 0) {
            const montoPorTerapeuta = (montoSuc / numTerapeutas) * prod.cantidad;
            for (const t of terapeutas!) {
              comisionesInsert.push({
                pedido_biored_id: pedido.id,
                persona_id:       t.id,
                tipo_persona:     "terapeuta",
                sucursal_id:      pedido.sucursal_id,
                monto:            montoPorTerapeuta,
              });
            }
          }
        }

        // Comisión asistentes: monto individual por asistente
        const cfgsAsis = (configAsis ?? []).filter(c => c.product_id === productId && c.monto > 0);
        for (const cfg of cfgsAsis) {
          comisionesInsert.push({
            pedido_biored_id: pedido.id,
            persona_id:       cfg.asistente_id,
            tipo_persona:     "asistente",
            sucursal_id:      pedido.sucursal_id,
            monto:            cfg.monto * prod.cantidad,
          });
        }
      }

      if (comisionesInsert.length > 0) {
        const { error: comErr } = await admin.from("comisiones_generadas").insert(comisionesInsert);
        if (comErr) console.error('[entregar] comisiones_generadas error:', comErr);
      }
    } catch (e) {
      console.error('[entregar] Error generando comisiones:', e);
    }
  }

  return NextResponse.json({ success: true, pedido_id: id });
}


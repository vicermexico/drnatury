import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { agruparPorCercania, type PedidoUbicado } from "@/lib/rutas/agrupar";

// Fase 3: Master dice cuantas rutas necesita y de que tamano (ej. "2
// rutas, 10 y 10") y aqui se arman de verdad -- se agrupan por
// cercania (ver agrupar.ts) los pedidos pendientes que ya tienen
// ubicacion de GPS y todavia no estan en ninguna ruta, se crea una fila
// en rutas_entrega por cada grupo, y se le pone a cada pedido en que
// ruta quedo y en que orden visitarlo.
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`rutas-generar:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as { tamanos?: number[] };
  const tamanos = (body.tamanos ?? []).filter((n) => Number.isInteger(n) && n > 0);
  if (tamanos.length === 0) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "Dime cuántas rutas necesitas y de qué tamaño" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: pedidos, error: dbErr } = await admin
    .from("pomada_pedidos")
    .select("id, lat, lng")
    .eq("estado", "pendiente")
    .is("ruta_id", null)
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  const puntos: PedidoUbicado[] = (pedidos ?? []).map((p) => ({
    id: p.id,
    lat: p.lat as number,
    lng: p.lng as number,
  }));

  if (puntos.length === 0) {
    return NextResponse.json(
      { error: "SIN_PEDIDOS", message: "No hay pedidos pendientes con ubicación para armar una ruta" },
      { status: 400 }
    );
  }

  const { grupos } = agruparPorCercania(puntos, tamanos);

  // Cuantas rutas ya existen, nada mas para numerar las nuevas "Ruta N"
  // sin repetir el numero de las que ya estaban.
  const { count: rutasExistentes } = await admin
    .from("rutas_entrega")
    .select("id", { count: "exact", head: true });

  const rutasCreadas: { id: string; etiqueta: string; cantidadPedidos: number }[] = [];

  for (let i = 0; i < grupos.length; i++) {
    const grupo = grupos[i];
    if (grupo.pedidoIds.length === 0) continue;

    const etiqueta = `Ruta ${(rutasExistentes ?? 0) + rutasCreadas.length + 1}`;
    const { data: ruta, error: rutaErr } = await admin
      .from("rutas_entrega")
      .insert({ etiqueta })
      .select("id, etiqueta")
      .single();

    if (rutaErr || !ruta) {
      return NextResponse.json({ error: "DB_ERROR", message: rutaErr?.message }, { status: 500 });
    }

    for (let orden = 0; orden < grupo.pedidoIds.length; orden++) {
      await admin
        .from("pomada_pedidos")
        .update({ ruta_id: ruta.id, orden_en_ruta: orden + 1 })
        .eq("id", grupo.pedidoIds[orden]);
    }

    rutasCreadas.push({ id: ruta.id, etiqueta: ruta.etiqueta, cantidadPedidos: grupo.pedidoIds.length });
  }

  return NextResponse.json({ rutasCreadas });
}

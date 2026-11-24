import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

// Fase 3 (sistema de choferes y entregas): le da a la pantalla
// /master/rutas todo lo que necesita pintar de un jalon -- las rutas ya
// armadas (con sus pedidos, en el orden sugerido, y el chofer asignado
// si ya se le puso uno), los pedidos pendientes que SI tienen ubicacion
// de GPS (listos para agruparse en una ruta nueva) y los que NO la
// tienen (se muestran aparte, porque no se pueden ubicar en el mapa).
export async function GET() {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const admin = createAdminClient();

  interface PedidoFila {
    id: string;
    nombre: string;
    celular: string;
    direccion: string;
    cantidad: number;
    horario: string;
    lat: number | null;
    lng: number | null;
    ruta_id: string | null;
    orden_en_ruta: number | null;
  }

  const [{ data: rutas }, { data: pedidosPendientes }] = await Promise.all([
    admin
      .from("rutas_entrega")
      .select("id, etiqueta, chofer_id, created_at, profiles:chofer_id(name, phone)")
      .order("created_at", { ascending: false }),
    admin
      .from("pomada_pedidos")
      .select("id, nombre, celular, direccion, cantidad, horario, lat, lng, ruta_id, orden_en_ruta")
      .eq("estado", "pendiente")
      .order("created_at") as unknown as Promise<{ data: PedidoFila[] | null }>,
  ]);

  const pedidosPorRuta = new Map<string, PedidoFila[]>();
  const sinRutaConUbicacion: PedidoFila[] = [];
  const sinRutaSinUbicacion: PedidoFila[] = [];

  for (const p of pedidosPendientes ?? []) {
    if (p.ruta_id) {
      const lista = pedidosPorRuta.get(p.ruta_id) ?? [];
      lista.push(p);
      pedidosPorRuta.set(p.ruta_id, lista);
    } else if (typeof p.lat === "number" && typeof p.lng === "number") {
      sinRutaConUbicacion.push(p);
    } else {
      sinRutaSinUbicacion.push(p);
    }
  }

  const rutasConPedidos = (rutas ?? []).map((r) => {
    const pedidos = (pedidosPorRuta.get(r.id) ?? []).sort(
      (a, b) => (a.orden_en_ruta ?? 0) - (b.orden_en_ruta ?? 0)
    );
    const choferInfo = r.profiles as unknown as { name: string; phone: string } | null;
    return {
      id: r.id,
      etiqueta: r.etiqueta,
      choferId: r.chofer_id,
      choferNombre: choferInfo?.name ?? null,
      pedidos,
    };
  });

  return NextResponse.json({
    rutas: rutasConPedidos,
    pendientesConUbicacion: sinRutaConUbicacion,
    pendientesSinUbicacion: sinRutaSinUbicacion,
  });
}

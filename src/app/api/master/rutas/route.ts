import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

// Fase 3 (sistema de choferes y entregas): le da a la pantalla
// /master/rutas todo lo que necesita pintar de un jalon -- las rutas ya
// armadas (con sus pedidos, en el orden sugerido, y el chofer asignado
// si ya se le puso uno), los pedidos pendientes que SI tienen ubicacion
// de GPS (listos para agruparse en una ruta nueva) y los que NO la
// tienen (se muestran aparte, porque no se pueden ubicar en el mapa).
// Monterrey ya no cambia de horario de verano (como el resto del pais
// desde 2022), siempre es UTC-6 -- por eso se puede calcular el
// "inicio de hoy" a mano sumando ese offset fijo, sin necesitar
// ninguna libreria de fechas/zonas horarias.
function inicioDeHoyMonterrey(): string {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Monterrey" }); // "YYYY-MM-DD"
  return `${hoy}T00:00:00-06:00`;
}

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

  const [{ data: rutas }, { data: pedidosPendientes }, { data: pedidosDeHoy }] = await Promise.all([
    admin
      .from("rutas_entrega")
      .select("id, etiqueta, chofer_id, created_at, profiles:chofer_id(name, phone)")
      .order("created_at", { ascending: false }),
    admin
      .from("pomada_pedidos")
      .select("id, nombre, celular, direccion, cantidad, horario, lat, lng, ruta_id, orden_en_ruta")
      .eq("estado", "pendiente")
      .order("created_at") as unknown as Promise<{ data: PedidoFila[] | null }>,
    admin
      .from("pomada_pedidos")
      .select("estado, precio_total, motivo_rechazo")
      .in("estado", ["entregado", "rechazado"])
      .gte("entregado_at", inicioDeHoyMonterrey()),
  ]);

  const entregadosHoy = (pedidosDeHoy ?? []).filter((p) => p.estado === "entregado");
  const rechazadosHoy = (pedidosDeHoy ?? []).filter((p) => p.estado === "rechazado");
  const motivosContados = new Map<string, number>();
  for (const p of rechazadosHoy) {
    const motivo = p.motivo_rechazo ?? "Sin motivo";
    motivosContados.set(motivo, (motivosContados.get(motivo) ?? 0) + 1);
  }
  const resumenHoy = {
    entregados: entregadosHoy.length,
    rechazados: rechazadosHoy.length,
    montoCobrado: entregadosHoy.reduce((sum, p) => sum + (p.precio_total ?? 0), 0),
    motivos: Array.from(motivosContados.entries()).map(([motivo, cantidad]) => ({ motivo, cantidad })),
  };

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
    resumenHoy,
  });
}

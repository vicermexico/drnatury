import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

// Fase 3 (panel del chofer): le da al chofer que tiene la sesion
// iniciada SOLO sus propias rutas asignadas, con sus pedidos en el
// orden sugerido de visita (ver /master/rutas, donde Master las arma).
export async function GET() {
  const { error, userId } = await guardRole("CHOFER");
  if (error) return error;

  const admin = createAdminClient();

  const { data: rutas, error: dbErr } = await admin
    .from("rutas_entrega")
    .select(
      "id, etiqueta, pomada_pedidos(id, nombre, celular, direccion, cantidad, precio_total, horario, lat, lng, orden_en_ruta, estado, motivo_rechazo)"
    )
    .eq("chofer_id", userId)
    .order("created_at", { ascending: false });

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  const rutasOrdenadas = (rutas ?? []).map((r) => ({
    id: r.id,
    etiqueta: r.etiqueta,
    pedidos: (r.pomada_pedidos as unknown as {
      id: string; nombre: string; celular: string; direccion: string; cantidad: number;
      precio_total: number; horario: string; lat: number | null; lng: number | null;
      orden_en_ruta: number | null; estado: string; motivo_rechazo: string | null;
    }[]).sort((a, b) => (a.orden_en_ruta ?? 0) - (b.orden_en_ruta ?? 0)),
  }));

  return NextResponse.json({ rutas: rutasOrdenadas });
}

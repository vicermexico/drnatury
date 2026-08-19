import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { EstadoCuentaClient } from "./EstadoCuentaClient";

export const dynamic = "force-dynamic";

export interface ComisionRow {
  pedido_biored_id: string;
  pedido_id:        string;
  fecha:            string;
  productos:        string;
  monto:            number;
}

async function getHistorial(personaId: string, desde?: string, hasta?: string): Promise<ComisionRow[]> {
  if (!desde || !hasta) return [];
  const admin = createAdminClient();
  let query = admin
    .from("comisiones_generadas")
    .select("monto, created_at, pedido_biored_id")
    .eq("persona_id", personaId)
    .order("created_at", { ascending: false });

  if (desde) query = query.gte("created_at", `${desde}T00:00:00.000-06:00`);
  if (hasta) query = query.lte("created_at", `${hasta}T23:59:59.999-06:00`);

  const { data: comisiones } = await query;
  if (!comisiones || comisiones.length === 0) return [];

  const pedidoIds = [...new Set(comisiones.map(c => c.pedido_biored_id).filter(Boolean))] as string[];
  const { data: pedidos } = await admin
    .from("pedidos_biored")
    .select("id, pedido_id, productos, created_at")
    .in("id", pedidoIds);

  const pedidoMap = new Map((pedidos ?? []).map(p => [p.id, p]));

  const grouped = new Map<string, ComisionRow>();
  for (const c of comisiones) {
    const pid = c.pedido_biored_id as string;
    const pedido = pedidoMap.get(pid);
    if (!pid || !pedido) continue;
    if (grouped.has(pid)) {
      grouped.get(pid)!.monto += c.monto as number;
    } else {
      const prods = (pedido.productos as { nombre: string; cantidad: number }[]) ?? [];
      grouped.set(pid, {
        pedido_biored_id: pid,
        pedido_id:        pedido.pedido_id as string,
        fecha:            pedido.created_at as string,
        productos:        prods.map(p => `${p.nombre} ×${p.cantidad}`).join(", ") || "—",
        monto:            c.monto as number,
      });
    }
  }
  return Array.from(grouped.values());
}

async function getCortes(personaId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cortes")
    .select("id, fecha_inicio, fecha_fin, monto_total, estado, imagen_pago_url, nota_pago, created_at")
    .eq("persona_id", personaId)
    .eq("tipo_persona", "terapeuta")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export default async function EstadoCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; desde?: string; hasta?: string }>;
}) {
  const profile = await requireRole("TERAPEUTA");
  const sp    = await searchParams;
  const tab   = sp.tab === "cortes" ? "cortes" : "historial";
  const desde = sp.desde ?? "";
  const hasta = sp.hasta ?? "";

  const [historial, cortes] = await Promise.all([
    getHistorial(profile.id, desde || undefined, hasta || undefined),
    getCortes(profile.id),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Estado de Cuenta</h1>
        <p className="text-sm text-gray-500 mt-1">Tus comisiones y cortes de pago</p>
      </div>
      <EstadoCuentaClient
        tab={tab}
        desde={desde}
        hasta={hasta}
        historial={historial}
        cortes={cortes as Corte[]}
      />
    </div>
  );
}

export interface Corte {
  id:                string;
  fecha_inicio:      string;
  fecha_fin:         string;
  monto_total:       number;
  estado:            string;
  imagen_pago_url?:  string | null;
  nota_pago?:        string | null;
  created_at:        string;
}

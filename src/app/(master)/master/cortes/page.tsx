import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { CortesClient } from "./CortesClient";

export const dynamic = "force-dynamic";

export interface Persona {
  id:    string;
  name:  string;
  phone: string;
}

export interface PedidoComisionRow {
  pedido_biored_id: string;
  pedido_id:        string;
  fecha:            string;
  productos:        string;
  monto:            number;
  comision_ids:     string[];
}

export interface DesgloseState {
  pedidos:       PedidoComisionRow[];
  total:         number;
  persona_id:    string;
  tipo_persona:  string;
  fecha_inicio:  string;
  fecha_fin:     string;
  error?:        string;
}

export interface CorteRow {
  id:               string;
  persona_id:       string;
  persona_nombre:   string;
  tipo_persona:     string;
  fecha_inicio:     string;
  fecha_fin:        string;
  monto_total:      number;
  estado:           string;
  imagen_pago_url?: string | null;
  nota_pago?:       string | null;
  pagado_at?:       string | null;
  created_at:       string;
}

async function getTerapeutas(): Promise<Persona[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, name, phone")
    .contains("roles", ["TERAPEUTA"])
    .is("deleted_at", null)
    .order("name");
  return (data ?? []) as Persona[];
}

async function getAsistentes(): Promise<Persona[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, name, phone")
    .contains("roles", ["ASISTENTE"])
    .is("deleted_at", null)
    .order("name");
  return (data ?? []) as Persona[];
}

async function getTodosLosCortes(): Promise<CorteRow[]> {
  const admin = createAdminClient();
  const { data: cortes } = await admin
    .from("cortes")
    .select("id, persona_id, tipo_persona, fecha_inicio, fecha_fin, monto_total, estado, imagen_pago_url, nota_pago, pagado_at, created_at")
    .order("created_at", { ascending: false });

  if (!cortes || cortes.length === 0) return [];

  const personaIds = [...new Set(cortes.map(c => c.persona_id))] as string[];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name")
    .in("id", personaIds);

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.name as string]));

  return cortes.map(c => ({
    ...c,
    persona_nombre: profileMap.get(c.persona_id as string) ?? "—",
  })) as CorteRow[];
}

async function verDesglose(
  _prevState: DesgloseState | null,
  formData: FormData
): Promise<DesgloseState | null> {
  "use server";
  const admin        = createAdminClient();
  const persona_id   = formData.get("persona_id")  as string;
  const tipo_persona = formData.get("tipo_persona") as string;
  const desde        = formData.get("desde")        as string;
  const hasta        = formData.get("hasta")        as string;

  if (!persona_id || !desde || !hasta) return null;

  const fmtFecha = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

  const emptyErr = (error: string): DesgloseState =>
    ({ pedidos: [], total: 0, persona_id, tipo_persona, fecha_inicio: desde, fecha_fin: hasta, error });

  // Validacion A: fecha_fin no puede ser fecha futura (manana en adelante)
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const mananaStr = manana.toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
  if (hasta >= mananaStr) {
    return emptyErr(
      `La fecha fin no puede ser una fecha futura. Elige hasta hoy o una fecha anterior.`
    );
  }

  // Validacion B: sin empalme con cortes existentes de esa persona
  const { data: cortesExistentes } = await admin
    .from("cortes")
    .select("fecha_inicio, fecha_fin")
    .eq("persona_id", persona_id)
    .order("created_at", { ascending: true });

  for (let i = 0; i < (cortesExistentes ?? []).length; i++) {
    const c = cortesExistentes![i];
    if (desde <= (c.fecha_fin as string) && hasta >= (c.fecha_inicio as string)) {
      return emptyErr(
        `Las fechas seleccionadas se empalman con el corte #${i + 1} ` +
        `(del ${fmtFecha(c.fecha_inicio as string)} al ${fmtFecha(c.fecha_fin as string)}). ` +
        `Elige un rango diferente.`
      );
    }
  }

  const { data: comisiones } = await admin
    .from("comisiones_generadas")
    .select("id, monto, created_at, pedido_biored_id")
    .eq("persona_id", persona_id)
    .gte("created_at", `${desde}T00:00:00.000-06:00`)
    .lte("created_at", `${hasta}T23:59:59.999-06:00`);

  if (!comisiones || comisiones.length === 0)
    return { pedidos: [], total: 0, persona_id, tipo_persona, fecha_inicio: desde, fecha_fin: hasta };

  const pedidoIds = [...new Set(comisiones.map(c => c.pedido_biored_id).filter(Boolean))] as string[];
  const { data: pedidos } = await admin
    .from("pedidos_biored")
    .select("id, pedido_id, productos, created_at")
    .in("id", pedidoIds);

  const pedidoMap = new Map((pedidos ?? []).map(p => [p.id, p]));

  const grouped = new Map<string, PedidoComisionRow>();
  for (const c of comisiones) {
    const pid    = c.pedido_biored_id as string;
    const pedido = pedidoMap.get(pid);
    if (!pid || !pedido) continue;
    if (grouped.has(pid)) {
      grouped.get(pid)!.monto += c.monto as number;
      grouped.get(pid)!.comision_ids.push(c.id as string);
    } else {
      const prods = (pedido.productos as { nombre: string; cantidad: number }[]) ?? [];
      grouped.set(pid, {
        pedido_biored_id: pid,
        pedido_id:        pedido.pedido_id as string,
        fecha:            pedido.created_at as string,
        productos:        prods.map(p => `${p.nombre} x${p.cantidad}`).join(", ") || "—",
        monto:            c.monto as number,
        comision_ids:     [c.id as string],
      });
    }
  }

  const pedidosArr = Array.from(grouped.values());
  const total = pedidosArr.reduce((sum, p) => sum + p.monto, 0);
  return { pedidos: pedidosArr, total, persona_id, tipo_persona, fecha_inicio: desde, fecha_fin: hasta };
}

async function hacerCorte(formData: FormData): Promise<void> {
  "use server";
  const admin        = createAdminClient();
  const persona_id   = formData.get("persona_id")   as string;
  const tipo_persona = formData.get("tipo_persona")  as string;
  const fecha_inicio = formData.get("fecha_inicio")  as string;
  const fecha_fin    = formData.get("fecha_fin")     as string;
  const monto_total  = Number(formData.get("monto_total"));
  const comision_ids = JSON.parse(formData.get("comision_ids") as string) as string[];

  const { data: corte, error } = await admin
    .from("cortes")
    .insert({ persona_id, tipo_persona, fecha_inicio, fecha_fin, monto_total, estado: "pendiente" })
    .select("id")
    .single();

  if (error || !corte) {
    console.error("Error creando corte:", error);
    return;
  }

  if (comision_ids.length > 0) {
    await admin
      .from("corte_comisiones")
      .insert(comision_ids.map(comision_id => ({ corte_id: corte.id, comision_id })));
  }

  revalidatePath("/master/cortes");
}

async function marcarPagado(formData: FormData): Promise<void> {
  "use server";
  const admin    = createAdminClient();
  const corte_id = formData.get("corte_id") as string;
  const nota     = (formData.get("nota") as string) || null;
  const imagen   = formData.get("imagen") as File | null;

  let imagen_pago_url: string | null = null;

  await admin.storage.createBucket("cortes-pagos", { public: true });

  if (imagen && imagen.size > 0) {
    const bytes    = await imagen.arrayBuffer();
    const buffer   = Buffer.from(bytes);
    const filename = `${corte_id}-${Date.now()}-${imagen.name}`;
    const { error: upErr } = await admin.storage
      .from("cortes-pagos")
      .upload(filename, buffer, { contentType: imagen.type, upsert: true });
    if (!upErr) {
      const { data: urlData } = admin.storage.from("cortes-pagos").getPublicUrl(filename);
      imagen_pago_url = urlData.publicUrl;
    } else {
      console.error("Error subiendo imagen de pago:", upErr);
    }
  }

  await admin
    .from("cortes")
    .update({
      estado: "pagado",
      nota_pago: nota,
      imagen_pago_url,
      pagado_at: new Date().toISOString(),
    })
    .eq("id", corte_id);

  revalidatePath("/master/cortes");
}

export default async function CortesPage() {
  await requireRole("MASTER");
  const [terapeutas, asistentes, cortes] = await Promise.all([
    getTerapeutas(),
    getAsistentes(),
    getTodosLosCortes(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cortes</h1>
        <p className="text-sm text-gray-500 mt-1">Genera y gestiona cortes de comisiones</p>
      </div>
      <CortesClient
        terapeutas={terapeutas}
        asistentes={asistentes}
        cortes={cortes}
        verDesglose={verDesglose}
        hacerCorte={hacerCorte}
        marcarPagado={marcarPagado}
      />
    </div>
  );
}
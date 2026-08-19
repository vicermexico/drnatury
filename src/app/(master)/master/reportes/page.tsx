import { createAdminClient } from "@/lib/supabase/admin";

async function getReportes() {
  const admin = createAdminClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const [citas, pacientesNuevos, citasPorSucursal, serviciosTop, productosMasVendidos] = await Promise.all([
    // Total citas del mes
    admin.from("appointments")
      .select("id, status", { count: "exact" })
      .gte("starts_at", startOfMonth)
      .lte("starts_at", endOfMonth)
      .is("deleted_at", null),

    // Pacientes nuevos del mes
    admin.from("profiles")
      .select("id", { count: "exact", head: true })
      .contains("roles", ["PACIENTE"])
      .gte("created_at", startOfMonth)
      .lte("created_at", endOfMonth)
      .is("deleted_at", null),

    // Citas por sucursal
    admin.from("appointments")
      .select("branch_id, branches(name)")
      .gte("starts_at", startOfMonth)
      .lte("starts_at", endOfMonth)
      .is("deleted_at", null)
      .not("branch_id", "is", null),

    // Servicios mÃ¡s solicitados
    admin.from("appointments")
      .select("service_id, services(name)")
      .gte("starts_at", startOfMonth)
      .lte("starts_at", endOfMonth)
      .is("deleted_at", null)
      .not("service_id", "is", null),

    // Productos mÃ¡s vendidos
    admin.from("inventory_movements")
      .select("product_id, quantity_after, quantity_before, products(name)")
      .eq("type", "VENTA")
      .gte("performed_at", startOfMonth)
      .lte("performed_at", endOfMonth),
  ]);

  // Contar citas por status
  const totalCitas = citas.count ?? 0;
  const citasConfirmadas = (citas.data ?? []).filter(c => c.status === "CONFIRMADA").length;
  const citasCanceladas = (citas.data ?? []).filter(c => c.status === "CANCELADA").length;

  // Agrupar citas por sucursal
  const sucursalMap: Record<string, { name: string; count: number }> = {};
  for (const c of citasPorSucursal.data ?? []) {
    const branch = Array.isArray(c.branches) ? c.branches[0] : c.branches as { name: string } | null;
    const nombre = branch?.name ?? "Sin sucursal";
    if (!sucursalMap[c.branch_id]) sucursalMap[c.branch_id] = { name: nombre, count: 0 };
    sucursalMap[c.branch_id].count++;
  }
  const sucursales = Object.values(sucursalMap).sort((a, b) => b.count - a.count);

  // Agrupar servicios
  const servicioMap: Record<string, { name: string; count: number }> = {};
  for (const s of serviciosTop.data ?? []) {
    const service = Array.isArray(s.services) ? s.services[0] : s.services as { name: string } | null;
    const nombre = service?.name ?? "Sin servicio";
    if (!servicioMap[s.service_id]) servicioMap[s.service_id] = { name: nombre, count: 0 };
    servicioMap[s.service_id].count++;
  }
  const servicios = Object.values(servicioMap).sort((a, b) => b.count - a.count).slice(0, 5);

  // Agrupar productos vendidos
  const productoMap: Record<string, { name: string; total: number }> = {};
  for (const m of productosMasVendidos.data ?? []) {
    const product = Array.isArray(m.products) ? m.products[0] : m.products as { name: string } | null;
    const nombre = product?.name ?? "Sin nombre";
    const vendido = (m.quantity_before ?? 0) - (m.quantity_after ?? 0);
    if (!productoMap[m.product_id]) productoMap[m.product_id] = { name: nombre, total: 0 };
    productoMap[m.product_id].total += vendido;
  }
  const productos = Object.values(productoMap).sort((a, b) => b.total - a.total).slice(0, 5);

  return {
    totalCitas,
    citasConfirmadas,
    citasCanceladas,
    pacientesNuevos: pacientesNuevos.count ?? 0,
    sucursales,
    servicios,
    productos,
  };
}

export default async function ReportesPage() {
  const data = await getReportes();
  const now = new Date();
  const mes = now.toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "America/Monterrey" });

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500 mt-1 capitalize">{mes}</p>
      </div>

      {/* Resumen de citas */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Citas del mes</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white border border-gray-200 p-5">
            <p className="text-3xl font-bold text-blue-600">{data.totalCitas}</p>
            <p className="text-sm text-gray-500 mt-1">Total</p>
          </div>
          <div className="rounded-2xl bg-white border border-gray-200 p-5">
            <p className="text-3xl font-bold text-green-600">{data.citasConfirmadas}</p>
            <p className="text-sm text-gray-500 mt-1">Confirmadas</p>
          </div>
          <div className="rounded-2xl bg-white border border-gray-200 p-5">
            <p className="text-3xl font-bold text-red-500">{data.citasCanceladas}</p>
            <p className="text-sm text-gray-500 mt-1">Canceladas</p>
          </div>
        </div>
      </div>

      {/* Pacientes nuevos */}
      <div className="rounded-2xl bg-white border border-gray-200 p-5">
        <p className="text-3xl font-bold text-purple-600">{data.pacientesNuevos}</p>
        <p className="text-sm text-gray-500 mt-1">Pacientes nuevos este mes</p>
      </div>

      {/* Citas por sucursal */}
      {data.sucursales.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Citas por sucursal</h2>
          <div className="space-y-2">
            {data.sucursales.map((s) => (
              <div key={s.name} className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-5 py-3">
                <p className="text-sm font-medium text-gray-900">ðŸ“ {s.name}</p>
                <p className="text-sm font-bold text-blue-600">{s.count} citas</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Servicios mÃ¡s solicitados */}
      {data.servicios.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Servicios mÃ¡s solicitados</h2>
          <div className="space-y-2">
            {data.servicios.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-4">#{i + 1}</span>
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                </div>
                <p className="text-sm font-bold text-green-600">{s.count} veces</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Productos mÃ¡s vendidos */}
      {data.productos.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Productos mÃ¡s vendidos</h2>
          <div className="space-y-2">
            {data.productos.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-4">#{i + 1}</span>
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                </div>
                <p className="text-sm font-bold text-purple-600">{p.total} piezas</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


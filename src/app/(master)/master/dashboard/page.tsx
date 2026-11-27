import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotificacionesButton } from "@/components/layout/paciente/NotificacionesButton";

export const revalidate = 0;

async function getStats() {
  const admin = createAdminClient();
  const today = new Date();
  const cst = new Date(today.toLocaleString("en-US", { timeZone: "America/Monterrey" }));
  const todayStart = new Date(Date.UTC(cst.getFullYear(), cst.getMonth(), cst.getDate(), 6, 0, 0));
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);
  const monthStart = new Date(Date.UTC(cst.getFullYear(), cst.getMonth(), 1, 6, 0, 0));

  const [patients, todayCitas, pendientesCitas, branches, soldToday, soldMonth] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true })
      .contains("roles", ["PACIENTE"]).is("deleted_at", null),
    admin.from("appointments").select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("starts_at", todayStart.toISOString())
      .lt("starts_at", todayEnd.toISOString()),
    admin.from("appointments").select("id", { count: "exact", head: true })
      .eq("status", "PENDIENTE").is("deleted_at", null),
    admin.from("branches").select("id", { count: "exact", head: true })
      .eq("is_active", true).is("deleted_at", null),
    admin.from("inventory_movements").select("quantity_before, quantity_after")
      .eq("type", "VENTA")
      .gte("performed_at", todayStart.toISOString())
      .lt("performed_at", todayEnd.toISOString()),
    admin.from("inventory_movements").select("quantity_before, quantity_after")
      .eq("type", "VENTA")
      .gte("performed_at", monthStart.toISOString())
      .lt("performed_at", todayEnd.toISOString()),
  ]);

  const totalVendidoHoy = (soldToday.data ?? []).reduce(
    (sum, m) => sum + ((m.quantity_before ?? 0) - (m.quantity_after ?? 0)), 0
  );
  const totalVendidoMes = (soldMonth.data ?? []).reduce(
    (sum, m) => sum + ((m.quantity_before ?? 0) - (m.quantity_after ?? 0)), 0
  );

  return {
    patients: patients.count ?? 0,
    todayCitas: todayCitas.count ?? 0,
    pendientesCitas: pendientesCitas.count ?? 0,
    branches: branches.count ?? 0,
    soldToday: totalVendidoHoy,
    soldMonth: totalVendidoMes,
  };
}

// El contenido que antes vivia en /master/reportes (pagina aparte) -- Vic
// pidio que esto reemplace la seccion de "Acciones frecuentes" aqui en
// Inicio, y que la pagina de Reportes como tal ya no exista.
async function getReportes() {
  const admin = createAdminClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const [citas, pacientesNuevos, citasPorSucursal, serviciosTop, productosMasVendidos] = await Promise.all([
    admin.from("appointments")
      .select("id, status", { count: "exact" })
      .gte("starts_at", startOfMonth)
      .lte("starts_at", endOfMonth)
      .is("deleted_at", null),
    admin.from("profiles")
      .select("id", { count: "exact", head: true })
      .contains("roles", ["PACIENTE"])
      .gte("created_at", startOfMonth)
      .lte("created_at", endOfMonth)
      .is("deleted_at", null),
    admin.from("appointments")
      .select("branch_id, branches(name)")
      .gte("starts_at", startOfMonth)
      .lte("starts_at", endOfMonth)
      .is("deleted_at", null)
      .not("branch_id", "is", null),
    admin.from("appointments")
      .select("service_id, services(name)")
      .gte("starts_at", startOfMonth)
      .lte("starts_at", endOfMonth)
      .is("deleted_at", null)
      .not("service_id", "is", null),
    admin.from("inventory_movements")
      .select("product_id, quantity_after, quantity_before, products(name)")
      .eq("type", "VENTA")
      .gte("performed_at", startOfMonth)
      .lte("performed_at", endOfMonth),
  ]);

  const totalCitas = citas.count ?? 0;
  const citasConfirmadas = (citas.data ?? []).filter(c => c.status === "CONFIRMADA").length;
  const citasCanceladas = (citas.data ?? []).filter(c => c.status === "CANCELADA").length;

  const sucursalMap: Record<string, { name: string; count: number }> = {};
  for (const c of citasPorSucursal.data ?? []) {
    const branch = Array.isArray(c.branches) ? c.branches[0] : c.branches as { name: string } | null;
    const nombre = branch?.name ?? "Sin sucursal";
    if (!sucursalMap[c.branch_id]) sucursalMap[c.branch_id] = { name: nombre, count: 0 };
    sucursalMap[c.branch_id].count++;
  }
  const sucursales = Object.values(sucursalMap).sort((a, b) => b.count - a.count);

  const servicioMap: Record<string, { name: string; count: number }> = {};
  for (const s of serviciosTop.data ?? []) {
    const service = Array.isArray(s.services) ? s.services[0] : s.services as { name: string } | null;
    const nombre = service?.name ?? "Sin servicio";
    if (!servicioMap[s.service_id]) servicioMap[s.service_id] = { name: nombre, count: 0 };
    servicioMap[s.service_id].count++;
  }
  const servicios = Object.values(servicioMap).sort((a, b) => b.count - a.count).slice(0, 5);

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

export default async function MasterDashboard() {
  const [stats, reportes] = await Promise.all([getStats(), getReportes()]);

  const now = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
    timeZone: "America/Monterrey",
  });
  const mes = new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "America/Monterrey" });

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bienvenido</h1>
        <p className="text-sm text-gray-500 mt-1 capitalize">{now}</p>
      </div>

      <NotificacionesButton />

      <div className="grid grid-cols-2 gap-4">
        <Link href="/master/citas" className="rounded-2xl bg-white border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition">
          <p className="text-3xl font-bold text-blue-600">{stats.todayCitas}</p>
          <p className="text-sm text-gray-500 mt-1">Citas hoy</p>
        </Link>

        <Link href="/master/citas" className="rounded-2xl bg-white border border-gray-200 p-5 hover:border-amber-300 hover:shadow-sm transition">
          <p className="text-3xl font-bold text-amber-500">{stats.pendientesCitas}</p>
          <p className="text-sm text-gray-500 mt-1">Por confirmar</p>
        </Link>

        <Link href="/master/pacientes" className="rounded-2xl bg-white border border-gray-200 p-5 hover:border-green-300 hover:shadow-sm transition">
          <p className="text-3xl font-bold text-green-600">{stats.patients}</p>
          <p className="text-sm text-gray-500 mt-1">Pacientes</p>
        </Link>

        <Link href="/master/sucursales" className="rounded-2xl bg-white border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition">
          <p className="text-3xl font-bold text-gray-700">{stats.branches}</p>
          <p className="text-sm text-gray-500 mt-1">Sucursales activas</p>
        </Link>

        <Link href="/master/inventario" className="rounded-2xl bg-white border border-gray-200 p-5 hover:border-purple-300 hover:shadow-sm transition">
          <p className="text-3xl font-bold text-purple-600">{stats.soldToday}</p>
          <p className="text-sm text-gray-500 mt-1">Productos vendidos hoy</p>
        </Link>

        <Link href="/master/inventario" className="rounded-2xl bg-white border border-gray-200 p-5 hover:border-purple-300 hover:shadow-sm transition">
          <p className="text-3xl font-bold text-indigo-600">{stats.soldMonth}</p>
          <p className="text-sm text-gray-500 mt-1">Vendidos este mes</p>
        </Link>
      </div>

      {/* Antes "Reportes" era una pagina aparte -- ahora vive aqui mismo */}
      <div className="space-y-8">
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Reportes</h2>
          <p className="text-xs text-gray-400 capitalize mb-3">{mes}</p>

          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Citas del mes</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <p className="text-3xl font-bold text-blue-600">{reportes.totalCitas}</p>
              <p className="text-sm text-gray-500 mt-1">Total</p>
            </div>
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <p className="text-3xl font-bold text-green-600">{reportes.citasConfirmadas}</p>
              <p className="text-sm text-gray-500 mt-1">Confirmadas</p>
            </div>
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <p className="text-3xl font-bold text-red-500">{reportes.citasCanceladas}</p>
              <p className="text-sm text-gray-500 mt-1">Canceladas</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-gray-200 p-5">
          <p className="text-3xl font-bold text-purple-600">{reportes.pacientesNuevos}</p>
          <p className="text-sm text-gray-500 mt-1">Pacientes nuevos este mes</p>
        </div>

        {reportes.sucursales.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Citas por sucursal</h3>
            <div className="space-y-2">
              {reportes.sucursales.map((s) => (
                <div key={s.name} className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-5 py-3">
                  <p className="text-sm font-medium text-gray-900">📍 {s.name}</p>
                  <p className="text-sm font-bold text-blue-600">{s.count} citas</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {reportes.servicios.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Servicios más solicitados</h3>
            <div className="space-y-2">
              {reportes.servicios.map((s, i) => (
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

        {reportes.productos.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Productos más vendidos</h3>
            <div className="space-y-2">
              {reportes.productos.map((p, i) => (
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
    </div>
  );
}

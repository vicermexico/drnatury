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

export default async function MasterDashboard() {
  const stats = await getStats();

  const now = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
    timeZone: "America/Monterrey",
  });

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

        <Link href="/master/configuracion" className="rounded-2xl bg-white border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition">
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

      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Acciones frecuentes
        </h2>
        <div className="space-y-2">
          {[
            { href: "/master/citas",         label: "Ver agenda de hoy",         desc: "Todas las citas del dia por sucursal" },
            { href: "/master/pacientes",     label: "Buscar paciente",           desc: "Historial y citas por paciente" },
            { href: "/master/configuracion", label: "Gestionar sucursales",      desc: "Sucursales, terapeutas y servicios" },
            { href: "/master/whatsapp",      label: "Editar mensajes WhatsApp",  desc: "Personaliza los templates de notificacion" },
          ].map(({ href, label, desc }) => (
            <Link key={href} href={href} className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition group">
              <div>
                <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
              <span className="text-gray-300 group-hover:text-blue-400">→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

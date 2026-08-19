import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { NotificacionesButton } from "@/components/layout/paciente/NotificacionesButton";

async function getStats(branchId: string) {
  const admin = createAdminClient();
  const today = new Date();
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 6, 0, 0));
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);

  const [patients, todayCitas, products] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true })
      .contains("roles", ["PACIENTE"])
      .eq("branch_id", branchId)
      .is("deleted_at", null),
    admin.from("appointments").select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .gte("starts_at", todayStart.toISOString())
      .lt("starts_at", todayEnd.toISOString()),
    admin.from("inventory_stock").select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .gt("quantity", 0),
  ]);

  return {
    patients: patients.count ?? 0,
    todayCitas: todayCitas.count ?? 0,
    products: products.count ?? 0,
  };
}

export default async function TerapeutaDashboard() {
  const profile = await requireRole("TERAPEUTA");
  const branchId = profile.branch_id ?? "";
  const stats = await getStats(branchId);

  const now = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
    timeZone: "America/Monterrey",
  });

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bienvenida</h1>
        <p className="text-sm text-gray-500 mt-1 capitalize">{now}</p>
      </div>

      <NotificacionesButton />

      <div className="grid grid-cols-2 gap-4">
        <Link href="/terapeuta/agenda" className="rounded-2xl bg-white border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition">
          <p className="text-3xl font-bold text-blue-600">{stats.todayCitas}</p>
          <p className="text-sm text-gray-500 mt-1">Citas hoy</p>
        </Link>
        <Link href="/terapeuta/agenda" className="rounded-2xl bg-white border border-gray-200 p-5 hover:border-green-300 hover:shadow-sm transition">
          <p className="text-3xl font-bold text-green-600">{stats.patients}</p>
          <p className="text-sm text-gray-500 mt-1">Mis pacientes</p>
        </Link>
        <Link href="/terapeuta/inventario" className="rounded-2xl bg-white border border-gray-200 p-5 hover:border-purple-300 hover:shadow-sm transition col-span-2">
          <p className="text-3xl font-bold text-purple-600">{stats.products}</p>
          <p className="text-sm text-gray-500 mt-1">Productos disponibles</p>
        </Link>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Acciones frecuentes</h2>
        <div className="space-y-2">
          {[
            { href: "/terapeuta/agenda",      label: "Ver agenda de hoy", desc: "Tus citas del día" },
            { href: "/terapeuta/citas/nueva", label: "Nueva cita",        desc: "Agendar una cita nueva" },
            { href: "/terapeuta/inventario",  label: "Ver inventario",    desc: "Productos disponibles en tu sucursal" },
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
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotificacionesButton } from "@/components/layout/paciente/NotificacionesButton";

async function getStats() {
  const admin = createAdminClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const [branches, therapists, services, soldToday] = await Promise.all([
    admin.from("branches").select("id", { count: "exact", head: true }).eq("is_active", true).is("deleted_at", null),
    admin.from("profiles").select("id", { count: "exact", head: true }).contains("roles", ["TERAPEUTA"]).eq("is_active", true).is("deleted_at", null),
    admin.from("services").select("id", { count: "exact", head: true }).eq("is_active", true).is("deleted_at", null),
    admin.from("inventory_movements").select("id", { count: "exact", head: true }).eq("type", "SALE").gte("created_at", todayISO),
  ]);

  return {
    branches: branches.count ?? 0,
    therapists: therapists.count ?? 0,
    services: services.count ?? 0,
    soldToday: soldToday.count ?? 0,
  };
}

export default async function MasterDashboard() {
  const stats = await getStats();

  const QUICK_ACTIONS = [
    { label: "Nueva sucursal",  href: "/master/sucursales/nueva",  desc: "Dar de alta una sucursal" },
    { label: "Nueva terapeuta", href: "/master/terapeutas/nueva",  desc: "Registrar una terapeuta" },
    { label: "Nuevo servicio",  href: "/master/servicios/nuevo",   desc: "Agregar servicio al catálogo" },
  ];

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">DrBioescaner — Panel de administración</p>
      </div>

      {/* Notificaciones */}
      <NotificacionesButton />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Sucursales activas",      value: stats.branches,   href: "/master/sucursales" },
          { label: "Terapeutas",              value: stats.therapists, href: "/master/terapeutas" },
          { label: "Servicios",               value: stats.services,   href: "/master/servicios" },
          { label: "Productos vendidos hoy",  value: stats.soldToday,  href: "/master/reportes" },
        ].map(({ label, value, href }) => (
          <Link
            key={label}
            href={href}
            className="rounded-2xl bg-white border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition"
          >
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </Link>
        ))}
      </div>

      {/* Acciones rápidas */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Acciones rápidas
        </h2>
        <div className="space-y-2">
          {QUICK_ACTIONS.map(({ label, href, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition group"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                  {label}
                </p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              <span className="text-gray-300 group-hover:text-blue-400 text-lg">→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

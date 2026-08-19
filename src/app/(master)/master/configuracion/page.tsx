import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

async function getConfigStats() {
  const admin = createAdminClient();
  const [branches, therapists, services] = await Promise.all([
    admin.from("branches").select("id", { count: "exact", head: true }).eq("is_active", true).is("deleted_at", null),
    admin.from("profiles").select("id", { count: "exact", head: true }).contains("roles", ["TERAPEUTA"]).eq("is_active", true).is("deleted_at", null),
    admin.from("services").select("id", { count: "exact", head: true }).eq("is_active", true).is("deleted_at", null),
  ]);
  return { branches: branches.count ?? 0, therapists: therapists.count ?? 0, services: services.count ?? 0 };
}

export default async function ConfiguracionPage() {
  const stats = await getConfigStats();

  const sections = [
    {
      href: "/master/sucursales",
      label: "Sucursales",
      desc: "Direcciones, horarios y capacidades",
      count: stats.branches,
      countLabel: "activas",
      action: "Nueva sucursal",
      actionHref: "/master/sucursales/nueva",
    },
    {
      href: "/master/terapeutas",
      label: "Terapeutas",
      desc: "Personal clínico por sucursal",
      count: stats.therapists,
      countLabel: "registradas",
      action: "Nueva terapeuta",
      actionHref: "/master/terapeutas/nueva",
    },
    {
      href: "/master/servicios",
      label: "Servicios",
      desc: "Catálogo de tratamientos y duración",
      count: stats.services,
      countLabel: "activos",
      action: "Nuevo servicio",
      actionHref: "/master/servicios/nuevo",
    },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">Administra sucursales, terapeutas y servicios</p>
      </div>

      <div className="space-y-3">
        {sections.map(({ href, label, desc, count, countLabel, action, actionHref }) => (
          <div key={href} className="rounded-2xl bg-white border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
              <span className="text-xs text-gray-400 bg-gray-50 rounded-lg px-2.5 py-1 border border-gray-100">
                {count} {countLabel}
              </span>
            </div>
            <div className="flex gap-2">
              <Link
                href={href}
                className="flex-1 text-center rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Ver todos
              </Link>
              <Link
                href={actionHref}
                className="flex-1 text-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
              >
                {action}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

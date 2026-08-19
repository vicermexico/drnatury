import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { TerapeutaBookingForm } from "@/components/forms/TerapeutaBookingForm";

async function getFormData(branchId: string) {
  const admin = createAdminClient();

  type ServiceRow = { id: string; name: string; duration_minutes: number };

  const [patientsRes, bsRes, branchRes] = await Promise.all([
    // Todos los pacientes activos (sin filtrar por sucursal)
    admin.from("profiles")
      .select("id, name, phone")
      .contains("roles", ["PACIENTE"])
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    // Servicios configurados para esta sucursal
    admin.from("branch_services")
      .select("price, services(id, name, duration_minutes)")
      .eq("branch_id", branchId),
    // Nombre de la sucursal
    admin.from("branches")
      .select("name")
      .eq("id", branchId)
      .single(),
  ]);

  const services = (bsRes.data ?? [])
    .map(bs => {
      const svc = Array.isArray(bs.services) ? bs.services[0] : bs.services as ServiceRow | null;
      return svc ? { ...svc, price: Number(bs.price) } : null;
    })
    .filter((s): s is ServiceRow & { price: number } => s !== null);

  return {
    patients:   patientsRes.data ?? [],
    services,
    branchName: branchRes.data?.name ?? "",
  };
}

export default async function TerapeutaNuevaCitaPage() {
  const therapist = await requireRole("TERAPEUTA");

  if (!therapist.branch_id) {
    return (
      <div className="space-y-4">
        <Link href="/terapeuta/agenda" className="text-sm text-gray-400 hover:text-gray-600">
          ← Agenda
        </Link>
        <div className="rounded-2xl bg-yellow-50 border border-yellow-200 p-5 text-sm text-yellow-800">
          No tienes una sucursal asignada. Contacta al administrador para que te asigne una.
        </div>
      </div>
    );
  }

  const { patients, services, branchName } = await getFormData(therapist.branch_id);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/terapeuta/agenda" className="text-sm text-gray-400 hover:text-gray-600">
          ← Agenda
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900">Nueva cita</h1>

      <div className="rounded-2xl bg-white border border-gray-200 p-5">
        <TerapeutaBookingForm
          patients={patients}
          services={services}
          branchId={therapist.branch_id}
          branchName={branchName}
          therapistId={therapist.id}
        />
      </div>
    </div>
  );
}

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppointmentForm } from "@/components/forms/AppointmentForm";

async function getData() {
  const admin = createAdminClient();
  const [patientsRes, branchesRes, servicesRes, therapistsRes] = await Promise.all([
    admin.from("profiles").select("id, name, phone")
      .contains("roles", ["PACIENTE"]).eq("is_active", true).is("deleted_at", null).order("name"),
    admin.from("branches").select("id, name, address, lat, lng")
      .eq("is_active", true).is("deleted_at", null).order("name"),
    admin.from("services").select("id, name, duration_minutes")
      .eq("is_active", true).is("deleted_at", null).order("name"),
    admin.from("profiles").select("id, name, branch_id")
      .contains("roles", ["TERAPEUTA"]).eq("is_active", true).is("deleted_at", null).order("name"),
  ]);
  return {
    patients:   patientsRes.data   ?? [],
    branches:   branchesRes.data   ?? [],
    services:   servicesRes.data   ?? [],
    therapists: therapistsRes.data ?? [],
  };
}

export default async function AsistenteNuevaCitaPage() {
  const { patients, branches, services, therapists } = await getData();
  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/asistente/citas" className="text-gray-400 hover:text-gray-600 text-sm">
          &larr; Citas
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nueva cita</h1>
      <AppointmentForm
        patients={patients}
        branches={branches}
        services={services}
        therapists={therapists}
        redirectTo="/asistente/citas"
      />
    </div>
  );
}
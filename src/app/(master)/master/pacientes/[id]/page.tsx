import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PatientActions } from "./PatientActions";
import type { AppointmentStatus } from "@/types";

async function getPatient(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, name, phone, birth_date, age, address, sex, city, email, consultation_reason, branch_id, is_active, created_at, branches(id, name)")
    .eq("id", id)
    .contains("roles", ["PACIENTE"])
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

async function getAppointments(patientId: string) {
  const admin = createAdminClient();
  // Tres FKs a profiles desde appointments: se usa el nombre completo del constraint
  // para que PostgREST no ambigue patient_id / therapist_id / created_by.
  const { data } = await admin
    .from("appointments")
    .select(`
      id, starts_at, ends_at, status, notes,
      services(name),
      branches(name),
      profiles!appointments_therapist_id_fkey(name)
    `)
    .eq("patient_id", patientId)
    .is("deleted_at", null)
    .order("starts_at", { ascending: false });
  return data ?? [];
}

async function getBranches() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");
  return data ?? [];
}

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDIENTE:  "Pendiente",
  CONFIRMADA: "Confirmada",
  CANCELADA:  "Cancelada",
  NO_ASISTIO: "No asistió",
  COMPLETADA: "Completada",
};

const STATUS_CLASS: Record<AppointmentStatus, string> = {
  PENDIENTE:  "bg-amber-100 text-amber-700",
  CONFIRMADA: "bg-blue-100 text-blue-700",
  CANCELADA:  "bg-gray-100 text-gray-500",
  NO_ASISTIO: "bg-orange-100 text-orange-700",
  COMPLETADA: "bg-green-100 text-green-700",
};

const SEX_LABEL: Record<string, string> = { M: "Masculino", F: "Femenino", OTRO: "Otro" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric", month: "short", year: "numeric", timeZone: "America/Monterrey",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Monterrey",
  });
}

function formatBirthDate(birthDate: string | null, age: number | null): string | null {
  if (birthDate) {
    const formatted = new Date(birthDate + "T00:00:00").toLocaleDateString("es-MX", {
      day: "numeric", month: "long", year: "numeric",
    });
    const today = new Date();
    const birth = new Date(birthDate + "T00:00:00");
    let currentAge = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) currentAge--;
    return `${formatted} · ${currentAge} años`;
  }
  if (age) return `${age} años`;
  return null;
}

type ApptRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  notes: string | null;
  services: { name: string } | null;
  branches: { name: string } | null;
  profiles: { name: string } | null;
};

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [patient, appointments, branches] = await Promise.all([
    getPatient(id),
    getAppointments(id),
    getBranches(),
  ]);

  if (!patient) notFound();

  const branch = Array.isArray(patient.branches)
    ? patient.branches[0]
    : (patient.branches as { id: string; name: string } | null);

  const ageDisplay = formatBirthDate(
    patient.birth_date as string | null,
    patient.age as number | null
  );

  const appts = appointments as unknown as ApptRow[];
  const now = new Date().toISOString();

  const completadas = appts.filter((a) => a.status === "COMPLETADA").length;
  const proxima = appts.find((a) =>
    a.starts_at > now && a.status !== "CANCELADA" && a.status !== "NO_ASISTIO"
  );

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-2 text-sm mb-3">
          <Link href="/master/pacientes" className="text-gray-400 hover:text-gray-600">Pacientes</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">{patient.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
          {!patient.is_active && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
              Inactivo
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-0.5">Registrado el {formatDate(patient.created_at)}</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Citas totales" value={String(appts.length)} />
        <StatCard label="Completadas" value={String(completadas)} />
        <StatCard
          label="Próxima cita"
          value={proxima ? formatDate(proxima.starts_at) : "—"}
          small={!!proxima}
        />
      </div>

      {/* Información */}
      <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Información</h2>
        <Row label="Teléfono" value={patient.phone} />
        {ageDisplay && <Row label="Nacimiento" value={ageDisplay} />}
        {patient.sex && <Row label="Sexo" value={SEX_LABEL[patient.sex] ?? patient.sex} />}
        {patient.email && <Row label="Correo" value={patient.email} />}
        {patient.address && <Row label="Dirección" value={patient.address} />}
        {patient.city && <Row label="Ciudad" value={patient.city} />}
        <Row label="Sucursal" value={branch?.name ?? "Sin asignar"} />
        {patient.consultation_reason && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Notas</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{patient.consultation_reason}</p>
          </div>
        )}
      </section>

      {/* Historial de citas */}
      <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Historial de citas
        </h2>
        {appts.length === 0 ? (
          <p className="text-sm text-gray-400">Sin citas registradas.</p>
        ) : (
          <div className="space-y-2">
            {appts.map((a) => (
              <div key={a.id} className="rounded-xl bg-gray-50 px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {a.services?.name ?? "Servicio desconocido"}
                  </p>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_CLASS[a.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{formatDateTime(a.starts_at)}</p>
                {(a.profiles?.name || a.branches?.name) && (
                  <p className="text-xs text-gray-400">
                    {[a.profiles?.name, a.branches?.name].filter(Boolean).join(" · ")}
                  </p>
                )}
                {a.notes && (
                  <p className="text-xs text-gray-500 bg-white rounded-lg px-3 py-2 border border-gray-100 mt-1">
                    {a.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Editar / Eliminar */}
      <PatientActions
        patient={{
          id: patient.id,
          name: patient.name,
          phone: patient.phone,
          birth_date: (patient.birth_date as string | null) ?? null,
          address: patient.address ?? null,
          sex: patient.sex ?? null,
          city: patient.city ?? null,
          email: patient.email ?? null,
          consultation_reason: patient.consultation_reason ?? null,
          branch_id: patient.branch_id ?? null,
          is_active: patient.is_active,
        }}
        branches={branches}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start text-sm gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-4 text-center">
      <p className={`font-bold text-gray-900 ${small ? "text-base" : "text-2xl"}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

import type { AppointmentStatus } from "@/types";
import { formatCSTDate, formatCSTDateShort, formatCSTTime } from "@/lib/appointments/availability";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDIENTE:   "Pendiente",
  CONFIRMADA:  "Confirmada",
  CANCELADA:   "Cancelada",
  NO_ASISTIO:  "No asistió",
  COMPLETADA:  "Completada",
};

const STATUS_CLASS: Record<AppointmentStatus, string> = {
  PENDIENTE:  "bg-yellow-50  text-yellow-700  border-yellow-200",
  CONFIRMADA: "bg-green-50   text-green-700   border-green-200",
  CANCELADA:  "bg-red-50     text-red-700     border-red-200",
  NO_ASISTIO: "bg-orange-50  text-orange-700  border-orange-200",
  COMPLETADA: "bg-gray-50    text-gray-500    border-gray-200",
};

const STATUS_DOT: Record<AppointmentStatus, string> = {
  PENDIENTE:  "bg-yellow-400",
  CONFIRMADA: "bg-green-500",
  CANCELADA:  "bg-red-400",
  NO_ASISTIO: "bg-orange-400",
  COMPLETADA: "bg-gray-300",
};

// Fondos para la variante "patient" — separados del STATUS_CLASS que usa la variante default
const PATIENT_CARD_BG: Record<AppointmentStatus, string> = {
  PENDIENTE:  "bg-green-50  border-green-200",
  CONFIRMADA: "bg-green-50  border-green-200",
  CANCELADA:  "bg-red-50    border-red-200",
  NO_ASISTIO: "bg-gray-50   border-gray-200",
  COMPLETADA: "bg-gray-50   border-gray-200",
};

function buildMapsUrlFromAddress(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export interface AppointmentData {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  branch_id?: string;
  service_id?: string;
  patient_name?: string;
  patient_phone?: string;
  service_name?: string;
  therapist_name?: string;
  branch_name?: string;
  modalidad?: "CONSULTORIO" | "DOMICILIO";
  domicilio_direccion?: string | null;
}

interface Props {
  appt: AppointmentData;
  showPatient?: boolean;
  showBranch?: boolean;
  showTherapist?: boolean;
  /** "patient" → hora y fecha grandes, servicio y sucursal oscuros abajo */
  variant?: "default" | "patient";
}

export function AppointmentCard({
  appt,
  showPatient = true,
  showBranch = false,
  showTherapist = false,
  variant = "default",
}: Props) {
  const statusClass = STATUS_CLASS[appt.status] ?? STATUS_CLASS.PENDIENTE;
  const dotClass   = STATUS_DOT[appt.status]   ?? STATUS_DOT.PENDIENTE;

  // ── Variante paciente ────────────────────────────────────
  if (variant === "patient") {
    const cardBg = PATIENT_CARD_BG[appt.status] ?? PATIENT_CARD_BG.PENDIENTE;
    return (
      <div className={`rounded-2xl border p-4 space-y-2.5 shadow-sm ${cardBg}`}>
        {/* Hora grande + fecha grande + badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span className="text-2xl font-bold text-gray-900 leading-none">
              {formatCSTTime(appt.starts_at)}
            </span>
            <span className="text-base font-semibold text-gray-700 leading-none">
              {formatCSTDateShort(appt.starts_at)}
            </span>
          </div>
          <span className={`inline-flex items-center gap-1.5 shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
            {STATUS_LABEL[appt.status]}
          </span>
        </div>

        {/* Servicio y sucursal — texto oscuro explícito */}
        <div className="space-y-0.5">
          {appt.service_name && (
            <p className="text-sm font-semibold text-gray-900">{appt.service_name}</p>
          )}
          {showBranch && appt.branch_name && appt.modalidad !== "DOMICILIO" && (
            <p className="text-sm font-medium text-gray-700">{appt.branch_name}</p>
          )}
          {appt.modalidad === "DOMICILIO" && (
            <div className="text-sm space-y-0.5">
              <p className="font-medium text-gray-700">🏠 A domicilio{appt.domicilio_direccion ? `: ${appt.domicilio_direccion}` : ""}</p>
              {appt.domicilio_direccion && (
                <a href={buildMapsUrlFromAddress(appt.domicilio_direccion)} target="_blank" rel="noopener noreferrer"
                  className="inline-block text-xs font-semibold text-blue-600 underline">
                  🗺️ Cómo llegar
                </a>
              )}
            </div>
          )}
          {showTherapist && appt.therapist_name && (
            <p className="text-sm text-gray-600">Terapeuta: {appt.therapist_name}</p>
          )}
          {showPatient && appt.patient_name && (
            <p className="text-sm text-gray-700">{appt.patient_name} · {appt.patient_phone}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Variante default (master/terapeuta) ──────────────────
  return (
    <div className={`rounded-2xl border p-4 space-y-2 ${statusClass}`}>
      {/* Hora + estado */}
      <div className="flex items-center justify-between">
        <span className="text-base font-bold">
          {formatCSTTime(appt.starts_at)}
          <span className="text-sm font-normal opacity-60">
            {" "}– {formatCSTTime(appt.ends_at)}
          </span>
        </span>
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusClass}`}>
          {STATUS_LABEL[appt.status]}
        </span>
      </div>

      {appt.service_name && (
        <p className="text-sm font-medium">{appt.service_name}</p>
      )}

      <div className="text-xs opacity-70 space-y-0.5">
        {showPatient && appt.patient_name && (
          <p>{appt.patient_name} · {appt.patient_phone}</p>
        )}
        {showTherapist && appt.therapist_name && (
          <p>Terapeuta: {appt.therapist_name}</p>
        )}
        {showBranch && appt.branch_name && appt.modalidad !== "DOMICILIO" && (
          <p>Sucursal: {appt.branch_name}</p>
        )}
        {appt.modalidad === "DOMICILIO" && (
          <p>
            🏠 A domicilio{appt.domicilio_direccion ? `: ${appt.domicilio_direccion}` : ""}
            {appt.domicilio_direccion && (
              <>
                {" "}·{" "}
                <a href={buildMapsUrlFromAddress(appt.domicilio_direccion)} target="_blank" rel="noopener noreferrer"
                  className="underline font-semibold">
                  🗺️ Cómo llegar
                </a>
              </>
            )}
          </p>
        )}
        <p>{formatCSTDate(appt.starts_at)}</p>
      </div>
    </div>
  );
}

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailableSlots, getDayKey, cstToUTC } from "@/lib/appointments/availability";
import type { WeeklySchedule, DaySchedule } from "@/types";

// Horario fijo usado para citas a domicilio: no dependen de una
// sucursal en particular, asi que se ofrece un rango amplio general.
const DOMICILIO_SCHEDULE: DaySchedule = {
  open: true,
  morning_start: "08:00",
  morning_end: "20:00",
};
// Tiempo extra que se bloquea en una cita a domicilio (traslado/instalacion)
// ademas de la duracion propia del servicio.
const DOMICILIO_EXTRA_MINUTES = 90;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const branchId  = searchParams.get("branch_id");
  const serviceId = searchParams.get("service_id");
  const dateStr   = searchParams.get("date");
  const modalidad = searchParams.get("modalidad") === "DOMICILIO" ? "DOMICILIO" : "CONSULTORIO";
  const therapistId = searchParams.get("therapist_id");
  if (!serviceId || !dateStr || (modalidad === "CONSULTORIO" && !branchId)) {
    return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
  }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
  if (dateStr < today) return NextResponse.json([], { status: 200 });
  const admin = createAdminClient();

  if (modalidad === "DOMICILIO") {
    const { data: svc } = await admin.from("services").select("duration_minutes").eq("id", serviceId).single();
    if (!svc) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const duration_minutes = (svc.duration_minutes ?? 60) + DOMICILIO_EXTRA_MINUTES;
    // Solo se respetan los bloqueos globales (sin sucursal especifica),
    // ya que domicilio no pertenece a ninguna sucursal en particular.
    const { data: blockedData } = await admin.from("blocked_slots").select("all_day, start_time, end_time, branch_id").eq("date", dateStr).is("branch_id", null);
    if ((blockedData ?? []).some(b => b.all_day)) return NextResponse.json([]);
    const blockedHours = (blockedData ?? []).filter(b => !b.all_day && b.start_time && b.end_time).map(b => ({ start_time: b.start_time!, end_time: b.end_time! }));
    // Si ya se conoce el terapeuta (por ejemplo, el terapeuta agendando su
    // propia cita), se descartan los horarios donde ya tiene otra cita —
    // asi evitamos que luego book_appointment rechace el slot como ocupado.
    // Cuando no se conoce el terapeuta todavia (master/asistente antes de
    // elegirlo), no se puede filtrar y el choque real se valida al confirmar.
    let existing: { starts_at: string; ends_at: string }[] = [];
    let capacity = 999;
    if (therapistId) {
      const dayStartUTC = cstToUTC(dateStr, "00:00").toISOString();
      const dayEndUTC   = cstToUTC(dateStr, "23:59").toISOString();
      const { data } = await admin
        .from("appointments")
        .select("starts_at, ends_at")
        .eq("therapist_id", therapistId)
        .is("deleted_at", null)
        .not("status", "in", '("CANCELADA","NO_ASISTIO")')
        .gte("starts_at", dayStartUTC)
        .lte("starts_at", dayEndUTC);
      existing = data ?? [];
      capacity = 1;
    }
    const slots = getAvailableSlots(dateStr, DOMICILIO_SCHEDULE, duration_minutes, capacity, existing, blockedHours);
    return NextResponse.json(slots);
  }

  const [branchRes, serviceRes] = await Promise.all([
    admin.from("branches").select("schedule, global_mode, global_capacity").eq("id", branchId).eq("is_active", true).is("deleted_at", null).single(),
    admin.from("branch_services").select("simultaneous_capacity, services(duration_minutes)").eq("branch_id", branchId).eq("service_id", serviceId).single(),
  ]);
  if (!branchRes.data || !serviceRes.data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const branchData = branchRes.data as { schedule: WeeklySchedule; global_mode: boolean; global_capacity: number };
  const globalMode = branchData.global_mode === true;
  const globalCapacity = branchData.global_capacity ?? 1;
  const svcData = Array.isArray(serviceRes.data.services) ? serviceRes.data.services[0] : serviceRes.data.services as { duration_minutes: number } | null;
  const duration_minutes = svcData?.duration_minutes ?? 60;
  const simultaneous_capacity = globalMode ? globalCapacity : (serviceRes.data.simultaneous_capacity ?? 1);
  const dayKey = getDayKey(dateStr);
  const daySchedule = branchData.schedule[dayKey] as DaySchedule | undefined;
  if (!daySchedule?.open) return NextResponse.json([], { status: 200 });
  const dayStartUTC = cstToUTC(dateStr, "00:00").toISOString();
  const dayEndUTC   = cstToUTC(dateStr, "23:59").toISOString();
  const notIn = '("CANCELADA","NO_ASISTIO")';
  let existing;
  if (globalMode) {
    const { data } = await admin.from("appointments").select("starts_at, ends_at").eq("branch_id", branchId).is("deleted_at", null).not("status", "in", notIn).gte("starts_at", dayStartUTC).lte("starts_at", dayEndUTC);
    existing = data;
  } else {
    const { data } = await admin.from("appointments").select("starts_at, ends_at").eq("branch_id", branchId).eq("service_id", serviceId).is("deleted_at", null).not("status", "in", notIn).gte("starts_at", dayStartUTC).lte("starts_at", dayEndUTC);
    existing = data;
  }
  const { data: blockedData } = await admin.from("blocked_slots").select("all_day, start_time, end_time, branch_id").eq("date", dateStr);
  const blocked = (blockedData ?? []).filter(b => b.branch_id === branchId || b.branch_id === null);
  if (blocked.some(b => b.all_day)) return NextResponse.json([]);
  const blockedHours = blocked.filter(b => !b.all_day && b.start_time && b.end_time).map(b => ({ start_time: b.start_time!, end_time: b.end_time! }));
  const slots = getAvailableSlots(dateStr, daySchedule, duration_minutes, simultaneous_capacity, existing ?? [], blockedHours);
  return NextResponse.json(slots);
}
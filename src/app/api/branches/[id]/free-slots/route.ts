import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAnyRole } from "@/lib/auth/api-guard";
import { getAvailableSlots, getDayKey, cstToUTC } from "@/lib/appointments/availability";
import type { WeeklySchedule, DaySchedule } from "@/types";

// Lista los bloques de 30 minutos del dia (segun el horario de la
// sucursal) marcando cuales ya estan ocupados por una cita o ya
// bloqueados — para que master pueda elegir directamente cuales
// horarios libres bloquear, en vez de escribir un rango a mano.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardAnyRole("MASTER", "ASISTENTE");
  if (error) return error;

  const { id: branchId } = await params;
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");
  if (!dateStr) return NextResponse.json({ error: "MISSING_DATE" }, { status: 400 });

  const admin = createAdminClient();

  const { data: branch } = await admin
    .from("branches")
    .select("schedule, simultaneous_capacity, global_mode, global_capacity")
    .eq("id", branchId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single();
  if (!branch) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const dayKey = getDayKey(dateStr);
  const daySchedule = (branch.schedule as WeeklySchedule)?.[dayKey] as DaySchedule | undefined;
  if (!daySchedule?.open) return NextResponse.json({ open: false, slots: [] });

  const capacity = branch.global_mode ? (branch.global_capacity ?? 1) : (branch.simultaneous_capacity ?? 1);

  const dayStartUTC = cstToUTC(dateStr, "00:00").toISOString();
  const dayEndUTC   = cstToUTC(dateStr, "23:59").toISOString();

  const { data: existing } = await admin
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("branch_id", branchId)
    .is("deleted_at", null)
    .not("status", "in", '("CANCELADA","NO_ASISTIO")')
    .gte("starts_at", dayStartUTC)
    .lte("starts_at", dayEndUTC);

  const { data: blockedData } = await admin
    .from("blocked_slots")
    .select("all_day, start_time, end_time, branch_id")
    .eq("date", dateStr);
  const blocked = (blockedData ?? []).filter(b => b.branch_id === branchId || b.branch_id === null);
  if (blocked.some(b => b.all_day)) return NextResponse.json({ open: true, allDayBlocked: true, slots: [] });
  const blockedHours = blocked.filter(b => !b.all_day && b.start_time && b.end_time).map(b => ({ start_time: b.start_time!, end_time: b.end_time! }));

  // Slots libres (30 min) para bloquear
  const freeSlots = getAvailableSlots(dateStr, daySchedule, 30, capacity, existing ?? [], blockedHours);

  return NextResponse.json({ open: true, allDayBlocked: false, slots: freeSlots });
}

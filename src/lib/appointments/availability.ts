import type { WeeklySchedule, DaySchedule } from "@/types";

// Monterrey no observa horario de verano â€” siempre UTC-6 (CST)
const CST_OFFSET_H = 6;

// Convierte fecha + hora local CST a objeto Date UTC
export function cstToUTC(dateStr: string, timeStr: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, m] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h + CST_OFFSET_H, m));
}

// Obtiene la clave del dÃ­a de la semana para una fecha CST ("YYYY-MM-DD")
export function getDayKey(dateStr: string): keyof WeeklySchedule {
  const [y, mo, d] = dateStr.split("-").map(Number);
  // Usamos mediodÃ­a UTC para evitar problemas en los lÃ­mites de dÃ­a
  const date = new Date(Date.UTC(y, mo - 1, d, 12, 0));
  const keys: (keyof WeeklySchedule)[] = [
    "sunday", "monday", "tuesday", "wednesday",
    "thursday", "friday", "saturday",
  ];
  return keys[date.getUTCDay()];
}

export interface SlotResult {
  starts_at: string; // ISO UTC
  ends_at: string;   // ISO UTC
}

interface ExistingAppt {
  starts_at: string;
  ends_at: string;
}

// Genera los slots disponibles para una fecha dada
interface BlockedHour {
  start_time: string;
  end_time: string;
}

export function getAvailableSlots(
  dateStr: string,
  daySchedule: DaySchedule,
  durationMinutes: number,
  capacity: number,
  existing: ExistingAppt[],
  blockedHours: BlockedHour[] = []
): SlotResult[] {
  if (!daySchedule.open) return [];

  const SLOT_MS = 30 * 60_000;
  const DURATION_MS = durationMinutes * 60_000;
  const results: SlotResult[] = [];

  const ranges: Array<{ start: string; end: string }> = [];
  if (daySchedule.morning_start && daySchedule.morning_end) {
    ranges.push({ start: daySchedule.morning_start, end: daySchedule.morning_end });
  }
  if (daySchedule.afternoon_start && daySchedule.afternoon_end) {
    ranges.push({ start: daySchedule.afternoon_start, end: daySchedule.afternoon_end });
  }

  for (const { start, end } of ranges) {
    const rangeStartMs = cstToUTC(dateStr, start).getTime();
    const rangeEndMs = cstToUTC(dateStr, end).getTime();

    let slotStartMs = rangeStartMs;
    while (slotStartMs + DURATION_MS <= rangeEndMs) {
      const slotEndMs = slotStartMs + DURATION_MS;
      // Verificar si el slot esta bloqueado por hora
      const isBlocked = blockedHours.some(b => {
        const bStart = cstToUTC(dateStr, b.start_time).getTime();
        const bEnd   = cstToUTC(dateStr, b.end_time).getTime();
        return slotStartMs < bEnd && slotEndMs > bStart;
      });
      if (!isBlocked && isSlotAvailable(slotStartMs, slotEndMs, capacity, existing)) {
        results.push({
          starts_at: new Date(slotStartMs).toISOString(),
          ends_at: new Date(slotEndMs).toISOString(),
        });
      }
      slotStartMs += SLOT_MS;
    }
  }

  return results;
}

function isSlotAvailable(
  slotStartMs: number,
  slotEndMs: number,
  capacity: number,
  existing: ExistingAppt[]
): boolean {
  const SLOT_MS = 30 * 60_000;
  let current = slotStartMs;

  while (current < slotEndMs) {
    const subEnd = current + SLOT_MS;
    const count = existing.filter((a) => {
      const aStart = new Date(a.starts_at).getTime();
      const aEnd = new Date(a.ends_at).getTime();
      return aStart < subEnd && aEnd > current;
    }).length;

    if (count >= capacity) return false;
    current += SLOT_MS;
  }

  return true;
}

// Formatea una fecha ISO UTC en hora CST para mostrar al usuario
export function formatCSTTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Monterrey",
    hour12: true,
  });
}

export function formatCSTDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Monterrey",
  });
}

// Formato corto para mostrar junto a la hora: "miÃ©. 4 jun."
export function formatCSTDateShort(isoString: string): string {
  return new Date(isoString).toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Monterrey",
  });
}



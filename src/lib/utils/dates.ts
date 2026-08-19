// Slot duration in minutes — base unit for availability algorithm (PRD §9)
export const SLOT_MINUTES = 30;

export function slotsRequired(durationMinutes: number): number {
  return Math.ceil(durationMinutes / SLOT_MINUTES);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function formatMexicoDate(date: Date): string {
  return date.toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Monterrey",
  });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Monterrey",
  });
}

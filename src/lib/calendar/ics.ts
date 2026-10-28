import "server-only";

// Helpers compartidos para generar archivos .ics (agregar un evento al
// calendario del celular — Google Calendar, Apple Calendar, Outlook, etc).
// Usado tanto por /api/appointments/[id]/ics (citas normales, con sesion)
// como por /api/quick/ics (link rapido de Master, sin sesion).

export function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function toIcsDate(iso: string): string {
  // YYYYMMDDTHHMMSSZ
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export interface IcsEventInput {
  uid: string;
  startsAtISO: string;
  endsAtISO: string;
  summary: string;
  description?: string;
  location?: string;
  alarmMinutesBefore?: number;
}

export function buildIcsEvent(input: IcsEventInput): string {
  const now = toIcsDate(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DrNatury//Citas//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsDate(input.startsAtISO)}`,
    `DTEND:${toIcsDate(input.endsAtISO)}`,
    `SUMMARY:${icsEscape(input.summary)}`,
  ];
  if (input.description) lines.push(`DESCRIPTION:${icsEscape(input.description)}`);
  if (input.location) lines.push(`LOCATION:${icsEscape(input.location)}`);
  if (input.alarmMinutesBefore) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Recordatorio",
      `TRIGGER:-PT${input.alarmMinutesBefore}M`,
      "END:VALARM"
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export function icsResponseHeaders(filename: string) {
  return {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  };
}

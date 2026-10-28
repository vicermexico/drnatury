import "server-only";
import { getValidAccessToken } from "./google-auth";

// Crea un evento directo en el Google Calendar de Master. Nunca lanza
// error hacia arriba -- si falla (no conectado, token invalido, etc.),
// regresa null y quien llama decide mostrar el boton de .ics como
// respaldo. Agendar/bloquear nunca debe fallar por culpa de Google.

export interface GoogleEventInput {
  summary: string;
  description?: string;
  location?: string;
  startISO: string;
  endISO: string;
  /** Minutos antes de la cita para cada recordatorio. Por defecto: 2 horas y 1 hora antes. */
  remindersMinutesBefore?: number[];
}

export async function createGoogleCalendarEvent(input: GoogleEventInput): Promise<string | null> {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return null;

    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        location: input.location,
        start: { dateTime: input.startISO },
        end: { dateTime: input.endISO },
        reminders: {
          useDefault: false,
          overrides: (input.remindersMinutesBefore ?? [120, 60]).map((minutes) => ({ method: "popup", minutes })),
        },
      }),
    });

    if (!res.ok) {
      console.error("Error creando evento en Google Calendar:", await res.text());
      return null;
    }
    const data = await res.json() as { id: string };
    return data.id;
  } catch (err) {
    console.error("Error creando evento en Google Calendar:", err);
    return null;
  }
}

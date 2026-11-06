import "server-only";
import { getValidAccessToken } from "./google-auth";

// Crea un evento directo en el Google Calendar de Master. Nunca lanza
// error hacia arriba -- si falla (no conectado, token invalido, etc.),
// regresa { id: null, error } y quien llama decide mostrar el boton de
// .ics como respaldo. Agendar/bloquear nunca debe fallar por culpa de
// Google, pero se guarda el motivo para poder mostrarlo si hace falta
// diagnosticar.

export interface GoogleEventInput {
  summary: string;
  description?: string;
  location?: string;
  startISO: string;
  endISO: string;
  /** Minutos antes de la cita para cada recordatorio. Por defecto: 2 horas y 1 hora antes. */
  remindersMinutesBefore?: number[];
  /** Color del evento en Google Calendar (colorId oficial de la API, ej. "5" = amarillo/Banana). */
  colorId?: string;
}

export interface GoogleEventResult {
  id: string | null;
  error?: string;
}

export async function createGoogleCalendarEvent(input: GoogleEventInput): Promise<GoogleEventResult> {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return { id: null, error: "No conectado a Google Calendar" };

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
        colorId: input.colorId,
        reminders: {
          useDefault: false,
          overrides: (input.remindersMinutesBefore ?? [120, 60]).map((minutes) => ({ method: "popup", minutes })),
        },
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text();
      console.error("Error creando evento en Google Calendar:", bodyText);
      return { id: null, error: `Google respondio ${res.status}` };
    }
    const data = await res.json() as { id: string };
    return { id: data.id };
  } catch (err) {
    console.error("Error creando evento en Google Calendar:", err);
    return { id: null, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export interface UpdateLocationResult {
  ok: boolean;
  error?: string;
}

// Cuando el paciente comparte su ubicacion (ver /ubicacion/[id]), se le
// agrega al evento que ya existe en el Google Calendar de Master: el
// campo "location" con las coordenadas (Google Calendar le arma el mapa
// solo) y el link de Maps en la descripcion, para que sea tocable desde
// la app de Calendar del celular.
export async function addLocationToGoogleEvent(eventId: string, lat: number, lng: number): Promise<UpdateLocationResult> {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return { ok: false, error: "No conectado a Google Calendar" };

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

    const getRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!getRes.ok) {
      const bodyText = await getRes.text();
      console.error("Error leyendo evento de Google Calendar:", bodyText);
      return { ok: false, error: `Google respondio ${getRes.status} al leer el evento` };
    }
    const current = await getRes.json() as { description?: string };
    const yaTieneLink = (current.description ?? "").includes(mapsUrl);
    const nuevaDescripcion = yaTieneLink
      ? current.description!
      : `${current.description ?? ""}\n\n📍 Ubicación del paciente: ${mapsUrl}`.trim();

    const patchRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ location: `${lat},${lng}`, description: nuevaDescripcion }),
    });
    if (!patchRes.ok) {
      const bodyText = await patchRes.text();
      console.error("Error actualizando ubicacion en Google Calendar:", bodyText);
      return { ok: false, error: `Google respondio ${patchRes.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("Error en addLocationToGoogleEvent:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailableSlots, getDayKey, cstToUTC, formatCSTTime } from "@/lib/appointments/availability";
import type { WeeklySchedule, DaySchedule } from "@/types";

// Consulta horarios libres DE VERDAD contra el calendario (mismo motor
// que usa el resto de la app en src/lib/appointments/availability.ts),
// para que el Asistente de WhatsApp pueda contestar "si tengo horario"
// en vez de inventarlo o depender de una respuesta fija.

const QUICK_SERVICE_NAME = "Consulta rapida (link)";
const DOMICILIO_EXTRA_MINUTES = 90;
const DOMICILIO_SCHEDULE: DaySchedule = { open: true, morning_start: "08:00", morning_end: "20:00" };

export type Turno = "manana" | "tarde" | null;

function horaCST24(isoUTC: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Monterrey",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date(isoUTC));
  const hora = partes.find((p) => p.type === "hour")?.value ?? "0";
  return parseInt(hora, 10) % 24;
}

// Fecha de "hoy" en CST, como "YYYY-MM-DD" -- para saber si el dia que
// pidieron es el mismo dia de hoy (y entonces ya no tiene caso
// preguntar "manana o tarde" si ya es tarde-noche, por ejemplo).
export function hoyCST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
}

// Hora actual en CST en formato 24h (0-23).
export function horaActualCST(): number {
  return horaCST24(new Date().toISOString());
}

export async function obtenerHorariosDisponibles(
  dateStr: string,
  modalidad: "CONSULTORIO" | "DOMICILIO",
  turno: Turno
): Promise<string[]> {
  const admin = createAdminClient();

  const { data: servicio } = await admin
    .from("services")
    .select("duration_minutes")
    .eq("name", QUICK_SERVICE_NAME)
    .maybeSingle();
  if (!servicio) return [];

  const dayStartUTC = cstToUTC(dateStr, "00:00").toISOString();
  const dayEndUTC = cstToUTC(dateStr, "23:59").toISOString();
  const notIn = '("CANCELADA","NO_ASISTIO")';

  const { data: blockedData } = await admin
    .from("blocked_slots")
    .select("all_day, start_time, end_time, branch_id")
    .eq("date", dateStr);

  let slots: { starts_at: string; ends_at: string }[];

  if (modalidad === "DOMICILIO") {
    const duration_minutes = servicio.duration_minutes + DOMICILIO_EXTRA_MINUTES;
    const blocked = (blockedData ?? []).filter((b) => b.branch_id === null);
    if (blocked.some((b) => b.all_day)) return [];
    const blockedHours = blocked.filter((b) => !b.all_day && b.start_time && b.end_time).map((b) => ({ start_time: b.start_time!, end_time: b.end_time! }));
    // Sin terapeuta elegido todavia no se puede filtrar por ocupado real
    // (mismo limite que ya tiene /api/appointments/availability).
    slots = getAvailableSlots(dateStr, DOMICILIO_SCHEDULE, duration_minutes, 999, [], blockedHours);
  } else {
    const { data: branch } = await admin
      .from("branches")
      .select("id, schedule, global_capacity")
      .eq("is_active", true)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (!branch) return [];

    const dayKey = getDayKey(dateStr);
    const daySchedule = (branch.schedule as WeeklySchedule)[dayKey];
    if (!daySchedule?.open) return [];

    const { data: existing } = await admin
      .from("appointments")
      .select("starts_at, ends_at")
      .eq("branch_id", branch.id)
      .is("deleted_at", null)
      .not("status", "in", notIn)
      .gte("starts_at", dayStartUTC)
      .lte("starts_at", dayEndUTC);

    const blocked = (blockedData ?? []).filter((b) => b.branch_id === branch.id || b.branch_id === null);
    if (blocked.some((b) => b.all_day)) return [];
    const blockedHours = blocked.filter((b) => !b.all_day && b.start_time && b.end_time).map((b) => ({ start_time: b.start_time!, end_time: b.end_time! }));

    const capacity = branch.global_capacity ?? 1;
    slots = getAvailableSlots(dateStr, daySchedule, servicio.duration_minutes, capacity, existing ?? [], blockedHours);
  }

  // Si es para hoy, no tiene caso ofrecer horas que ya pasaron (o que
  // estan a punto de pasar) -- se deja un margen de 1 hora para que
  // de tiempo de llegar/prepararse.
  const esHoy = dateStr === hoyCST();
  const ahoraMasMargenMs = Date.now() + 60 * 60_000;
  const vigentes = esHoy ? slots.filter((s) => new Date(s.starts_at).getTime() >= ahoraMasMargenMs) : slots;

  const filtrados = turno
    ? vigentes.filter((s) => {
        const h = horaCST24(s.starts_at);
        return turno === "manana" ? h < 14 : h >= 14;
      })
    : vigentes;

  return filtrados.map((s) => formatCSTTime(s.starts_at));
}

// Lee "lunes", "martes", ..., "hoy", "mañana" (como dia de manana, no
// turno) y lo convierte a una fecha "YYYY-MM-DD" en CST. Si no reconoce
// nada, regresa null.
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

export function interpretarFecha(textoNormalizado: string, ahoraCST: Date = new Date()): string | null {
  const hoyStr = ahoraCST.toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
  if (textoNormalizado.includes("hoy")) return hoyStr;

  if (/\bmanana\b/.test(textoNormalizado) && !textoNormalizado.includes("por la manana") && !textoNormalizado.includes("en la manana")) {
    const [y, m, d] = hoyStr.split("-").map(Number);
    const manana = new Date(Date.UTC(y, m - 1, d + 1, 12));
    return manana.toISOString().slice(0, 10);
  }

  const diaMatch = DIAS_SEMANA.find((d) => textoNormalizado.includes(d));
  if (diaMatch) {
    const objetivo = DIAS_SEMANA.indexOf(diaMatch);
    const [y, m, d] = hoyStr.split("-").map(Number);
    const hoyDate = new Date(Date.UTC(y, m - 1, d, 12));
    const hoyDow = hoyDate.getUTCDay();
    let delta = (objetivo - hoyDow + 7) % 7;
    if (delta === 0) delta = 7; // si dice "el jueves" y hoy es jueves, se asume el proximo
    const resultado = new Date(Date.UTC(y, m - 1, d + delta, 12));
    return resultado.toISOString().slice(0, 10);
  }

  return null;
}

export function interpretarTurno(textoNormalizado: string): Turno {
  if (textoNormalizado.includes("tarde")) return "tarde";
  if (textoNormalizado.includes("manana") || textoNormalizado.includes("temprano")) return "manana";
  return null;
}

// "2026-11-19" -> "jueves 19/11/2026", para que el resumen final de
// Agendado muestre la fecha real y no lo que haya escrito la persona
// ("jueves", "mañana", etc.).
export function formatFechaBonita(fechaStr: string): string {
  const [y, m, d] = fechaStr.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d, 12));
  const diaSemana = new Intl.DateTimeFormat("es-MX", { weekday: "long", timeZone: "America/Monterrey" }).format(fecha);
  return `${diaSemana} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

// Convierte lo que haya escrito la persona para la hora ("3", "3pm",
// "15:00", "a las 9") a un formato fijo "h:mm am/pm". Si no se puede
// leer ninguna hora, regresa el texto tal cual para no perder la
// respuesta.
export function formatearHora(texto: string, turno: Turno): string {
  const m = texto.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?m\.?|p\.?m\.?)?/i);
  if (!m) return texto.trim();
  let hora = parseInt(m[1], 10);
  const minutos = m[2] ?? "00";
  const sufijoTexto = m[3]?.toLowerCase().replace(/\./g, "");

  let esPM: boolean;
  if (sufijoTexto?.startsWith("p")) {
    esPM = true;
  } else if (sufijoTexto?.startsWith("a")) {
    esPM = false;
  } else if (hora === 0) {
    esPM = false;
    hora = 12;
  } else if (hora > 12) {
    esPM = true;
    hora -= 12;
  } else if (hora === 12) {
    esPM = true; // mediodia
  } else {
    // Hora ambigua (1-11, sin am/pm) -- se usa el turno que ya se
    // pregunto antes para decidir.
    esPM = turno === "tarde";
  }

  return `${hora}:${minutos} ${esPM ? "pm" : "am"}`;
}

// Si la persona contesta con un numero suelto (ej. "4") que coincide
// con una de las horas que el bot ya le ofrecio (ej. "04:00 p.m."),
// se usa esa opcion tal cual -- es mas confiable que adivinar am/pm
// por el turno, sobre todo el mismo dia de hoy donde el turno real
// puede no coincidir con el que se supuso al preguntar el dia.
export function buscarEnOpcionesOfrecidas(texto: string, opciones: string[] | undefined): string | null {
  if (!opciones || opciones.length === 0) return null;
  const m = texto.match(/\d{1,2}/);
  if (!m) return null;
  const buscado = parseInt(m[0], 10);
  const encontrada = opciones.find((op) => {
    const om = op.match(/^0?(\d{1,2})/);
    return om ? parseInt(om[1], 10) === buscado : false;
  });
  return encontrada ?? null;
}

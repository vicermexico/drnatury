import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailableSlots, getDayKey, cstToUTC, formatCSTTime } from "@/lib/appointments/availability";
import { getDomicilioExtraMinutes } from "@/lib/appointments/domicilioConfig";
import type { WeeklySchedule, DaySchedule } from "@/types";

// Consulta horarios libres DE VERDAD contra el calendario (mismo motor
// que usa el resto de la app en src/lib/appointments/availability.ts),
// para que el Asistente de WhatsApp pueda contestar "si tengo horario"
// en vez de inventarlo o depender de una respuesta fija.

const QUICK_SERVICE_NAME = "Consulta rapida (link)";
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
    const duration_minutes = servicio.duration_minutes + (await getDomicilioExtraMinutes());
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

// Si junto al nombre del dia dicen "la proxima semana" (o equivalente),
// no es el [dia] mas cercano que caiga en los proximos 7 dias -- es ese
// mismo dia pero de la semana siguiente. Ej. hoy viernes 20, "el sabado"
// solo = manana (21); "la proxima semana el sabado" = el sabado de la
// semana que sigue (28), una semana despues del mas cercano.
const PROXIMA_SEMANA_KEYWORDS = [
  "proxima semana",
  "semana que viene",
  "semana que entra",
  "siguiente semana",
  "otra semana",
];

export function interpretarFecha(textoNormalizado: string, ahoraCST: Date = new Date()): string | null {
  const hoyStr = ahoraCST.toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
  if (textoNormalizado.includes("hoy")) return hoyStr;

  // "en 8 dias", "de mañana en 8 dias", "de hoy en 8 dias" -- cuentan
  // los dias EXACTOS a partir de hoy. Esto va antes del checar la
  // palabra "manana" sola, porque "de manana en 8 dias" es un modismo
  // (como "de hoy en ocho") donde "manana" NO significa "el dia de
  // manana" -- significa "a partir de manana", y lo que de verdad
  // cuenta es el numero de dias que sigue. Sin este caso, "de manana
  // en 8 dias" se leia como "manana" a secas, ignorando el "en 8 dias".
  const enDiasMatch = textoNormalizado.match(/\ben\s+(\d{1,2})\s*dias?\b/);
  if (enDiasMatch) {
    const n = parseInt(enDiasMatch[1], 10);
    const [y, m, d] = hoyStr.split("-").map(Number);
    const fecha = new Date(Date.UTC(y, m - 1, d + n, 12));
    return fecha.toISOString().slice(0, 10);
  }

  // "pasado mañana" tiene que ir ANTES del checar "manana" sola -- la
  // palabra "manana" tambien aparece completa dentro de "pasado manana",
  // asi que sin este caso se leia como "manana" a secas (un dia de
  // menos). Vic lo reporto: pidio "pasado mañana" un miercoles y el bot
  // le agendo para el jueves (manana), cuando debia ser el viernes.
  if (/\bpasado\s+manana\b/.test(textoNormalizado)) {
    const [y, m, d] = hoyStr.split("-").map(Number);
    const pasadoManana = new Date(Date.UTC(y, m - 1, d + 2, 12));
    return pasadoManana.toISOString().slice(0, 10);
  }

  if (/\bmanana\b/.test(textoNormalizado) && !textoNormalizado.includes("por la manana") && !textoNormalizado.includes("en la manana")) {
    const [y, m, d] = hoyStr.split("-").map(Number);
    const manana = new Date(Date.UTC(y, m - 1, d + 1, 12));
    return manana.toISOString().slice(0, 10);
  }

  // Si dan un numero de dia del mes explicito (ej. "jueves 26", "para
  // el 26", "el 26 de noviembre"), ese numero manda sobre el nombre
  // del dia de la semana -- antes, si decian "jueves 26" pero hoy no
  // era jueves, se calculaba el jueves MAS CERCANO ignorando el "26"
  // que la persona si dio explicito, agendando un dia equivocado.
  // Ojo: un numero pegado a la palabra "persona(s)" (ej. "vamos a ser
  // 2 personas") NO es el dia del mes -- sin este cuidado, "2
  // personas" se leia como "el dia 2", agendando un mes completo mal.
  const numMatch = textoNormalizado.match(/\b([1-9]|[12]\d|3[01])\b(?!\s*personas?\b)/);
  if (numMatch) {
    const diaNum = parseInt(numMatch[1], 10);
    const [y, m, d] = hoyStr.split("-").map(Number);
    let anio = y;
    let mes = m;
    if (diaNum < d) {
      mes += 1;
      if (mes > 12) {
        mes = 1;
        anio += 1;
      }
    }
    const fecha = new Date(Date.UTC(anio, mes - 1, diaNum, 12));
    return fecha.toISOString().slice(0, 10);
  }

  const diaMatch = DIAS_SEMANA.find((d) => textoNormalizado.includes(d));
  if (diaMatch) {
    const objetivo = DIAS_SEMANA.indexOf(diaMatch);
    const [y, m, d] = hoyStr.split("-").map(Number);
    const hoyDate = new Date(Date.UTC(y, m - 1, d, 12));
    const hoyDow = hoyDate.getUTCDay();
    let delta = (objetivo - hoyDow + 7) % 7;
    if (delta === 0) delta = 7; // si dice "el jueves" y hoy es jueves, se asume el proximo
    if (PROXIMA_SEMANA_KEYWORDS.some((k) => textoNormalizado.includes(k))) delta += 7;
    const resultado = new Date(Date.UTC(y, m - 1, d + delta, 12));
    return resultado.toISOString().slice(0, 10);
  }

  return null;
}

export function interpretarTurno(textoNormalizado: string): Turno {
  if (textoNormalizado.includes("tarde")) return "tarde";
  // "de manana en 8 dias" usa la palabra "manana" como parte del
  // modismo de fecha relativa (ver interpretarFecha) -- NO quiere decir
  // que pide el turno de la manana. Sin esta excepcion, ese mensaje se
  // leia como turno="manana" y pisaba el turno ("tarde") que la
  // persona ya habia dicho antes.
  if (/\bmanana\s+en\s+\d/.test(textoNormalizado)) return null;
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

// Para que el mensaje no se vea tan largo cuando hay muchos horarios
// libres (ej. un dia completamente vacio), se muestra nada mas una
// muestra repartida a lo largo de todo el rango -- desde el primero
// hasta el ultimo -- en vez de la lista completa. Ojo: esto es solo
// para lo que se MUESTRA; la persona puede pedir cualquier otra hora
// de las que no se le mostraron y el bot de todas formas la acepta si
// de verdad esta libre (eso ya se revisa aparte).
export function muestrearHorarios(horarios: string[], cantidad = 7): string[] {
  if (horarios.length <= cantidad) return horarios;
  const paso = (horarios.length - 1) / (cantidad - 1);
  const indices = new Set<number>();
  for (let i = 0; i < cantidad; i++) {
    indices.add(Math.round(i * paso));
  }
  return [...indices].sort((a, b) => a - b).map((i) => horarios[i]);
}

// "2026-11-19" + 1 -> "2026-11-20". Para revisar si hay espacio en los
// dias siguientes cuando el pedido no cupo en el dia original.
export function sumarDias(fechaStr: string, dias: number): string {
  const [y, m, d] = fechaStr.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d + dias, 12));
  return fecha.toISOString().slice(0, 10);
}

// Lee la hora que dijo la persona, pero SOLO cuando no hay forma de
// confundirla (trae "am"/"pm" explicito, o ya viene en 24 horas tipo
// "18:00") -- a diferencia de formatearHora, aqui NO se adivina el
// am/pm por el turno, porque esto se usa para revisar disponibilidad
// de TODO el dia (manana y tarde juntos), y adivinar mal haria que se
// agendara a una hora que la persona nunca pidio.
export function extraerHoraExplicita(texto: string): { hora24: number; minuto: number } | null {
  const m = texto.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?m\.?|p\.?m\.?)?/i);
  if (!m) return null;
  const hora = parseInt(m[1], 10);
  const minuto = m[2] !== undefined ? parseInt(m[2], 10) : 0;
  const sufijo = m[3]?.toLowerCase().replace(/\./g, "");

  if (sufijo) {
    const esPM = sufijo.startsWith("p");
    const hora24 = esPM ? (hora % 12) + 12 : hora % 12;
    return { hora24, minuto };
  }
  // Sin am/pm: solo se acepta si ya es inequivoco (13-23, o "0"
  // medianoche) -- de 1 a 12 sin am/pm es ambiguo, se deja pasar.
  if (hora >= 13 && hora <= 23) return { hora24: hora, minuto };
  if (hora === 0) return { hora24: 0, minuto };
  return null;
}

// Busca, entre opciones YA FORMATEADAS como "6:00 pm", cual coincide
// exacto con la hora explicita que dijo la persona (comparando en 24
// horas, para no confundir "6am" con "6pm"). Si la hora que dijeron es
// ambigua (sin am/pm y entre 1-12), regresa null -- mejor no adivinar.
export function buscarHoraExactaEnOpciones(texto: string, opciones: string[]): string | null {
  const explicita = extraerHoraExplicita(texto);
  if (!explicita) return null;

  return (
    opciones.find((op) => {
      const om = op.match(/^0?(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)/i);
      if (!om) return false;
      const h = parseInt(om[1], 10);
      const minuto = parseInt(om[2], 10);
      const sufijo = om[3].toLowerCase().replace(/\./g, "");
      const esPM = sufijo.startsWith("p");
      const hora24 = esPM ? (h % 12) + 12 : h % 12;
      return hora24 === explicita.hora24 && minuto === explicita.minuto;
    }) ?? null
  );
}

// Si la persona contesta con un numero suelto (ej. "4") que coincide
// con una de las horas que el bot ya le ofrecio (ej. "04:00 p.m."),
// se usa esa opcion tal cual -- es mas confiable que adivinar am/pm
// por el turno, sobre todo el mismo dia de hoy donde el turno real
// puede no coincidir con el que se supuso al preguntar el dia.
export function buscarEnOpcionesOfrecidas(texto: string, opciones: string[] | undefined): string | null {
  if (!opciones || opciones.length === 0) return null;
  const m = texto.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!m) return null;
  const horaBuscada = parseInt(m[1], 10);
  const minutoBuscado = m[2] !== undefined ? parseInt(m[2], 10) : null;
  // Si dan los minutos tambien (ej. "11:30"), hay que exigir que
  // coincidan exacto -- si no, "11:30" encontraba la primera opcion
  // que empezara con "11" (ej. "11:00 a.m.") en vez de la correcta.
  const encontrada = opciones.find((op) => {
    const om = op.match(/^0?(\d{1,2}):(\d{2})/);
    if (!om) return false;
    if (parseInt(om[1], 10) !== horaBuscada) return false;
    if (minutoBuscado !== null) return parseInt(om[2], 10) === minutoBuscado;
    return true;
  });
  return encontrada ?? null;
}

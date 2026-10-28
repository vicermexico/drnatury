// Lee el texto que Vic ya llena en WhatsApp (el formato de "Agendado")
// y saca los datos automaticamente, para que no tenga que volver a
// escribirlos campo por campo en el link rapido.
//
// Formato esperado (tal como Vic lo llena en WhatsApp):
//
//   Agendado
//
//   - Nombre: Miguel Angel Aguilar y
//   Luis Gerardo Aguilar
//   - Dia: Sabado 31/10/26
//   - Hora: 3:30pm
//   CONSULTORIO: Si, San Blas
//   DOMICILIO: No
//   - # Personas: 2
//   - COSTO TOTAL: $400

export interface ParsedAgendado {
  nombre: string;
  fecha: string;              // "YYYY-MM-DD" o "" si no se pudo leer
  hora: string;                // "HH:MM" (24h) o "" si no se pudo leer
  modalidad: "CONSULTORIO" | "DOMICILIO" | null;
  domicilioDireccion: string;
  numPersonas: string;
  costoTotal: string;
  errores: string[];
}

function sinAcentos(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Quita vinetas, guiones, emojis, selectores de variacion, etc. al inicio
// de la linea para poder comparar solo el texto de la etiqueta.
function limpiarInicio(line: string): string {
  return line.replace(/^[\s\-▪️*•·.︎️]+/u, "").trim();
}

type Campo = "nombre" | "dia" | "hora" | "consultorio" | "domicilio" | "personas" | "costo" | "lugar-header" | null;

function detectarCampo(lineaLimpia: string): Campo {
  const norm = sinAcentos(lineaLimpia).toUpperCase();
  if (norm.startsWith("NOMBRE")) return "nombre";
  if (norm.startsWith("DIA")) return "dia";
  if (norm.startsWith("HORA")) return "hora";
  if (norm.startsWith("CONSULTORIO")) return "consultorio";
  if (norm.startsWith("DOMICILIO")) return "domicilio";
  if (norm.startsWith("PERSONAS") || norm.startsWith("# PERSONAS") || norm.startsWith("#PERSONAS")) return "personas";
  if (norm.startsWith("COSTO")) return "costo";
  if (norm.startsWith("LUGAR")) return "lugar-header"; // se ignora, es solo encabezado
  return null;
}

function valorDeLinea(lineaLimpia: string): string {
  const idx = lineaLimpia.indexOf(":");
  if (idx === -1) return "";
  return lineaLimpia.slice(idx + 1).trim();
}

export function parseAgendado(texto: string): ParsedAgendado {
  const lineas = texto.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  const valores: Partial<Record<Exclude<Campo, null | "lugar-header">, string>> = {};
  let campoActual: Campo = null;

  for (const lineaCruda of lineas) {
    if (/^AGENDADO$/i.test(lineaCruda)) continue;
    if (/^REQUISITOS/i.test(lineaCruda)) break; // de aqui en adelante ya no es informacion a leer

    const limpia = limpiarInicio(lineaCruda);
    const campo = detectarCampo(limpia);

    if (campo && campo !== "lugar-header") {
      campoActual = campo;
      const valor = valorDeLinea(limpia);
      valores[campo] = valor;
    } else if (campo === "lugar-header") {
      campoActual = null;
    } else if (campoActual === "nombre") {
      // Linea de continuacion (nombre en varias lineas)
      valores.nombre = `${valores.nombre ?? ""} ${limpia}`.trim();
    }
  }

  const errores: string[] = [];

  const nombre = (valores.nombre ?? "").trim();
  if (!nombre) errores.push("No encontre el Nombre.");

  let fecha = "";
  const diaTexto = valores.dia ?? "";
  const fechaMatch = diaTexto.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (fechaMatch) {
    const [, dd, mm, yyRaw] = fechaMatch;
    const yyyy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;
    fecha = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  } else {
    errores.push("No pude leer la fecha en Dia (usa el formato DD/MM/AA, ej. 31/10/26).");
  }

  let hora = "";
  const horaTexto = valores.hora ?? "";
  const horaMatch = horaTexto.match(/(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?/i);
  if (horaMatch) {
    let [, hh, min, ampm] = horaMatch;
    let h = parseInt(hh, 10);
    const esPM = /p/i.test(ampm ?? "");
    const esAM = /a/i.test(ampm ?? "");
    if (esPM && h < 12) h += 12;
    if (esAM && h === 12) h = 0;
    hora = `${String(h).padStart(2, "0")}:${min}`;
  } else {
    errores.push("No pude leer la Hora (ej. 3:30pm).");
  }

  const consultorioVal = sinAcentos(valores.consultorio ?? "").toUpperCase();
  const domicilioVal = valores.domicilio ?? "";
  const domicilioValNorm = sinAcentos(domicilioVal).toUpperCase();

  let modalidad: "CONSULTORIO" | "DOMICILIO" | null = null;
  let domicilioDireccion = "";

  if (consultorioVal.startsWith("SI")) {
    modalidad = "CONSULTORIO";
  } else if (domicilioValNorm.startsWith("SI")) {
    modalidad = "DOMICILIO";
    const resto = domicilioVal.replace(/^[Ss][ií]\.?,?\s*/, "").trim();
    domicilioDireccion = resto;
  } else {
    errores.push("No indicaste 'Si' en Consultorio o en Domicilio.");
  }

  const personasDigits = (valores.personas ?? "").match(/\d+/);
  const numPersonas = personasDigits ? personasDigits[0] : "1";

  const costoDigits = (valores.costo ?? "").replace(/[^\d.]/g, "");
  const costoTotal = costoDigits;

  return { nombre, fecha, hora, modalidad, domicilioDireccion, numPersonas, costoTotal, errores };
}

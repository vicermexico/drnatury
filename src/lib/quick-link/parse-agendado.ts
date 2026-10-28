// Lee el texto que Vic ya llena en WhatsApp (el formato de "Agendado")
// y saca los datos automaticamente, para que no tenga que volver a
// escribirlos campo por campo en el link rapido.
//
// Vic no siempre pone ":" despues de cada etiqueta (a veces pone ".",
// a veces nada), y la linea del Nombre muchas veces NO lleva la palabra
// "Nombre" -- solo empieza directo con el nombre de la persona. Por eso
// el parser es tolerante: si una linea no coincide con ninguna etiqueta
// conocida, se pega al campo que se estaba leyendo (por defecto, al
// Nombre, ya que casi siempre es lo primero).
//
// Ejemplo real tal como lo pega Vic:
//
//   Agendado
//
//   - Miguel angel Aguilar y
//   Luis Gerardo Aguilar
//   - Día. Sabado 31/10/26
//   - Hora. 3:30pm
//   ▪️︎ CONSULTORIO Si,  San Blas
//   ▪️︎ DOMICILIO No
//   - # Personas 2
//   - COSTO TOTAL $400

export interface ParsedAgendado {
  nombre: string;
  fecha: string;              // "YYYY-MM-DD" o "" si no se pudo leer
  hora: string;                // "HH:MM" (24h) o "" si no se pudo leer
  modalidad: "CONSULTORIO" | "DOMICILIO" | null;
  domicilioDireccion: string;
  numPersonas: string;
  costoTotal: string;
  /** Solo digitos, ej. "8181234567". Vacio si Vic no lo incluyo en el texto (es opcional). */
  telefono: string;
  errores: string[];
}

type Campo = "nombre" | "dia" | "hora" | "consultorio" | "domicilio" | "personas" | "costo" | "telefono";

function sinAcentos(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Quita vinetas, guiones, emojis, selectores de variacion, etc. al inicio
// de la linea para poder comparar solo el texto de la etiqueta.
function limpiarInicio(line: string): string {
  return line.replace(/^[\s\-▪️*•·︎️]+/u, "").trim();
}

// Etiquetas conocidas, en el orden en que normalmente aparecen. Cada una
// se reconoce solo por como empieza la linea (sin importar que venga
// despues: ":", ".", un espacio, o nada).
const ETIQUETAS: { campo: Campo; patron: RegExp }[] = [
  { campo: "nombre", patron: /^nombre/i },
  { campo: "dia", patron: /^d[ií]a/i },
  { campo: "hora", patron: /^hora/i },
  { campo: "consultorio", patron: /^consultorio/i },
  { campo: "domicilio", patron: /^domicilio/i },
  { campo: "personas", patron: /^#?\s*personas/i },
  { campo: "costo", patron: /^costo/i },
  { campo: "telefono", patron: /^tel(e|é)fono|^tel\b|^cel(ular)?\b|^whats?app/i },
];

// "Lugar" es solo un encabezado de seccion en la plantilla vacia, sin
// valor propio -- se reconoce para no pegarlo por accidente a otro campo.
const ETIQUETA_LUGAR = /^lugar/i;

function detectarEtiqueta(lineaLimpia: string): { campo: Campo; resto: string } | "lugar" | null {
  if (ETIQUETA_LUGAR.test(lineaLimpia)) return "lugar";
  for (const { campo, patron } of ETIQUETAS) {
    const m = patron.exec(lineaLimpia);
    if (m) {
      const resto = lineaLimpia.slice(m[0].length).replace(/^[:.\-,\s]+/, "");
      return { campo, resto };
    }
  }
  return null;
}

export function parseAgendado(texto: string): ParsedAgendado {
  const lineas = texto.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  const valores: Partial<Record<Campo, string>> = {};
  // Casi siempre lo primero que viene (sin etiqueta) es el nombre.
  let campoActual: Campo | null = "nombre";

  for (const lineaCruda of lineas) {
    if (/^AGENDADO$/i.test(lineaCruda)) continue;
    if (/^REQUISITOS/i.test(lineaCruda)) break; // de aqui en adelante ya no es informacion a leer

    const limpia = limpiarInicio(lineaCruda);
    if (!limpia) continue;

    const deteccion = detectarEtiqueta(limpia);

    if (deteccion === "lugar") {
      campoActual = null; // encabezado sin valor, no pegar nada aqui
    } else if (deteccion) {
      campoActual = deteccion.campo;
      valores[deteccion.campo] = deteccion.resto;
    } else if (campoActual) {
      // Linea de continuacion (ej. nombre en varias lineas)
      valores[campoActual] = `${valores[campoActual] ?? ""} ${limpia}`.trim();
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
    const [, hh, min, ampm] = horaMatch;
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

  const telefono = (valores.telefono ?? "").replace(/\D/g, "");

  return { nombre, fecha, hora, modalidad, domicilioDireccion, numPersonas, costoTotal, telefono, errores };
}

// "Cerebro" del asistente de WhatsApp -- lo usa la pagina de demo/entrenamiento
// en /master/asistente-whatsapp (texto por ahora, nada conectado a WhatsApp
// real todavia). La idea: Master "platica" con el bot como si fuera un
// paciente, y cuando el bot contesta mal, Master ensena la respuesta correcta
// (ver /api/master/bot-demo/ensenar) -- esa correccion se guarda en la tabla
// whatsapp_bot_correcciones y la proxima vez que alguien escriba ALGO MUY
// PARECIDO, se usa esa respuesta ya corregida antes que cualquier otra regla.

export interface MensajeChat {
  rol: "paciente" | "bot";
  texto: string;
}

export interface EstadoAgendado {
  fase: "inicio" | "conversando" | "agendando";
  paso?: "modalidad" | "lugar" | "personas" | "dia" | "hora" | "nombre";
  modalidad?: "CONSULTORIO" | "DOMICILIO";
  lugar?: string;
  personas?: string;
  dia?: string;
  hora?: string;
  esperaConfirmacionAgendar?: boolean;
}

export interface Correccion {
  disparador: string; // ya normalizado
  respuesta: string;
}

export const ESTADO_INICIAL: EstadoAgendado = { fase: "inicio" };

export const WELCOME_TEXT = `Nuestros 2 consultorios de DrNatury estan  ubicados en:

📍 Dr. Mariano Azuela 211,
Col. Valle de San Blas
García, N.L.

📍 Antequera 252, Fraccionamiento Malaga, Mitras Pomiente, Garcia NL

Tambien podemos ir a TU  DOMICILIO siempre y cuando vivas en:
- García
- Santa Catarina
- San Pedro
- Escobedo
- Carmen (Algunas zonas)
- Monterrey
- San Nicolas
- Apodaca (Algunas zonas)

De Lunes a Sábado
⏰ Horario: 9am a 8pm.

⚡ PROMO
- COSTO CONSULTORIO $199
- COSTO EN SU DOMICILIO DE $399

⚠️ Importante: ¡Todo es con cita previa!
EL SERVICIO EN TU DOMICILIO NO CAMBIA  NADA AL CONSULTORIO`;

export const REQUISITOS_TEXT = `REQUISITOS
• 10 minutos antes del estudio, evitar alimentos
• NO traer nada puesto de joyas que contengan ORO, PLATA o BRONCE
• Contar con cubrebocas
• 2 horas antes le mandamos mensaje de Recordatorio, nos ayuda porfa a confirmar para que su cita no sea cancelada
• NO Contar con Marcapasos
• No estar en estado de Embarazo o en lactancia`;

export const PRECIO_DURACION_TEXT = `El estudio dura de 2 a 3 minutos, más 10 a 15 minutos de consulta (el precio ya incluye consulta y estudio).
Consultorio: $199. A domicilio: $399.`;

// Quita acentos, mayusculas, signos y espacios repetidos para poder
// comparar texto de forma tolerante (igual que el resto de los parsers
// de la app).
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contieneAlguna(normalizado: string, frases: string[]): boolean {
  return frases.some((f) => normalizado.includes(f));
}

const URGENCIA_KEYWORDS = ["dolor de pecho", "me duele el pecho", "duele el pecho", "falta de aire", "no puedo respirar", "me ahogo", "ahogo"];
const ORDEN_MEDICA_KEYWORDS = ["me dijo el doctor", "me indico el doctor", "me indico el medico", "me dijo el medico", "me mando a hacer", "me receto", "un tac", "hacerme un tac", "resonancia", "estudio de sangre", "analisis de sangre"];
const PRECIO_KEYWORDS = ["cuesta", "costo", "precio", "cuanto es", "cuanto vale"];
const DURACION_KEYWORDS = ["cuanto dura", "cuanto tarda", "cuanto tiempo", "dura el estudio", "tarda la cita", "tarda por persona"];
const AGENDAR_PALABRAS_ACCION = ["quiero", "sacar", "agend", "dar", "dame", "podria", "pudiera", "como le hago", "cuando"];
const AFIRMATIVO_KEYWORDS = ["si", "claro", "va", "sale", "dale", "esta bien", "de acuerdo", "porfavor", "por favor"];
const SINTOMA_KEYWORDS = ["duele", "dolor", "molestia", "me siento", "siento", "adormecid", "hormigueo", "me canso", "cansancio", "mareo"];

const PARTES_CUERPO: { palabra: string; frase: string }[] = [
  { palabra: "espalda", frase: "su espalda" },
  { palabra: "talon", frase: "su talón" },
  { palabra: "rodilla", frase: "su rodilla" },
  { palabra: "higado", frase: "eso del hígado" },
  { palabra: "vesicula", frase: "eso de la vesícula" },
  { palabra: "cabeza", frase: "su cabeza" },
  { palabra: "cuello", frase: "su cuello" },
  { palabra: "hombro", frase: "su hombro" },
  { palabra: "cintura", frase: "su cintura" },
  { palabra: "estomago", frase: "su estómago" },
  { palabra: "pierna", frase: "su pierna" },
  { palabra: "brazo", frase: "su brazo" },
  { palabra: "rodillas", frase: "sus rodillas" },
  { palabra: "piernas", frase: "sus piernas" },
];

// Se fija si hay intencion de agendar sin depender de que sea la frase
// exacta -- "sacar cita", "sacar una cita", "sacar la cita" deben contar
// igual. Si ya dice "agend" (agendar/agenda) alcanza solo con eso.
function esIntencionAgendar(normalizado: string): boolean {
  if (normalizado.includes("agend")) return true;
  if (!normalizado.includes("cita")) return false;
  return AGENDAR_PALABRAS_ACCION.some((p) => normalizado.includes(p));
}

function detectarParteCuerpo(normalizado: string): string {
  const match = PARTES_CUERPO.find((p) => normalizado.includes(p.palabra));
  return match ? match.frase : "eso";
}

// Intenta leer un codigo de anuncio al inicio del primer mensaje, ej.
// "B3 - Hola..." o "C6, hola...". Solo para mostrarlo en la demo -- el
// codigo real en produccion vendria del nombre del contacto (P-####) o de
// este mismo patron al inicio del mensaje.
export function detectarCodigoAnuncio(mensaje: string): string | null {
  const m = mensaje.trim().match(/^([A-Za-z]\d{1,3})\s*[-,.]?\s/);
  return m ? m[1].toUpperCase() : null;
}

function siguientePreguntaLugar(modalidad: "CONSULTORIO" | "DOMICILIO"): string {
  return modalidad === "CONSULTORIO"
    ? "¿Sería en Mitras o en San Blas?"
    : "¿En qué municipio sería (García, Santa Catarina, San Pedro, Escobedo, Carmen, Monterrey, San Nicolás o Apodaca)?";
}

function construirResumenAgendado(estado: EstadoAgendado, nombre: string): string {
  const personasNum = Math.max(1, parseInt(estado.personas ?? "1", 10) || 1);
  const costoPorPersona = estado.modalidad === "DOMICILIO" ? 399 : 199;
  const costoTotal = personasNum * costoPorPersona;
  const lineaConsultorio = estado.modalidad === "CONSULTORIO" ? `Si, ${estado.lugar ?? ""}`.trim() : "No";
  const lineaDomicilio = estado.modalidad === "DOMICILIO" ? `Si, ${estado.lugar ?? ""}`.trim() : "No";

  return [
    "Agendado",
    "",
    `• Nombre: ${nombre}`,
    "• Celular: (el numero de WhatsApp del paciente, automatico)",
    `• Día: ${estado.dia ?? ""}`,
    `• Hora: ${estado.hora ?? ""}`,
    "• Lugar:",
    `  ▪️︎ CONSULTORIO ${lineaConsultorio}`,
    `  ▪️︎ DOMICILIO ${lineaDomicilio}`,
    `• # Personas: ${personasNum}`,
    `• COSTO TOTAL $${costoTotal}`,
  ].join("\n");
}

export interface ResultadoRespuesta {
  respuesta: string;
  nuevoEstado: EstadoAgendado;
  nota?: string;
}

export function generarRespuesta(args: {
  mensaje: string;
  estado: EstadoAgendado;
  correcciones: Correccion[];
}): ResultadoRespuesta {
  const { mensaje, estado, correcciones } = args;
  const normalizado = normalizar(mensaje);

  // 1) Primer mensaje de la conversacion: siempre audio + texto de
  // bienvenida, sin importar que haya escrito la persona.
  if (estado.fase === "inicio") {
    const codigo = detectarCodigoAnuncio(mensaje);
    return {
      respuesta: `🔊 [Aquí se manda el audio de bienvenida que ya tienes grabado]\n\n${WELCOME_TEXT}`,
      nuevoEstado: { fase: "conversando" },
      nota: codigo ? `Código de anuncio detectado: ${codigo}` : undefined,
    };
  }

  // 2) Si ya le ensenaste exactamente que contestar ante este mensaje,
  // eso manda sobre cualquier otra regla.
  const correccionExacta = correcciones.find((c) => c.disparador === normalizado);
  if (correccionExacta) {
    return { respuesta: correccionExacta.respuesta, nuevoEstado: estado, nota: "Respuesta aprendida" };
  }

  // 3) Si estamos a la mitad de agendar una cita, seguimos la pregunta
  // que sigue en ese flujo.
  if (estado.fase === "agendando" && estado.paso) {
    switch (estado.paso) {
      case "modalidad": {
        const modalidad: "CONSULTORIO" | "DOMICILIO" = normalizado.includes("domicilio") ? "DOMICILIO" : "CONSULTORIO";
        const nuevoEstado: EstadoAgendado = { fase: "agendando", paso: "lugar", modalidad };
        return { respuesta: siguientePreguntaLugar(modalidad), nuevoEstado };
      }
      case "lugar": {
        const nuevoEstado: EstadoAgendado = { ...estado, paso: "personas", lugar: mensaje.trim() };
        return { respuesta: "¿Cuántas personas serían?", nuevoEstado };
      }
      case "personas": {
        const nuevoEstado: EstadoAgendado = { ...estado, paso: "dia", personas: mensaje.trim() };
        return { respuesta: "¿Para qué día le gustaría agendar?", nuevoEstado };
      }
      case "dia": {
        const nuevoEstado: EstadoAgendado = { ...estado, paso: "hora", dia: mensaje.trim() };
        return { respuesta: "¿A qué hora le quedaría mejor?", nuevoEstado };
      }
      case "hora": {
        const nuevoEstado: EstadoAgendado = { ...estado, paso: "nombre", hora: mensaje.trim() };
        return { respuesta: "¿A qué nombre le agendo la cita?", nuevoEstado };
      }
      case "nombre": {
        const resumen = construirResumenAgendado(estado, mensaje.trim());
        return {
          respuesta: `${resumen}\n\n${REQUISITOS_TEXT}`,
          nuevoEstado: { fase: "conversando" },
        };
      }
    }
  }

  // 4) Conversacion libre: urgencias primero, sin excepcion.
  if (contieneAlguna(normalizado, URGENCIA_KEYWORDS)) {
    return {
      respuesta: "Eso sí es bueno que lo chequen pronto con un médico o en una clínica, nada más para estar tranquilos de que todo esté bien. Y ya después con calma lo podemos ver aquí también.",
      nuevoEstado: { ...estado, fase: "conversando" },
    };
  }

  // 5) Ya trae indicacion medica especifica (TAC, estudio, etc.)
  if (contieneAlguna(normalizado, ORDEN_MEDICA_KEYWORDS)) {
    return {
      respuesta: "Ah ok, nada más le comento con toda honestidad: este estudio no profundiza tanto como el que le indicó el médico. Aquí vemos más por encima pero de forma más amplia, para ver de dónde viene el problema en general, y ya después nos enfocamos en lo específico. ¿Le gustaría agendar su cita?",
      nuevoEstado: { ...estado, fase: "conversando", esperaConfirmacionAgendar: true },
    };
  }

  // 6) Confirmacion de "si" despues de la pregunta anterior -> arranca el agendado.
  if (estado.esperaConfirmacionAgendar && contieneAlguna(normalizado, AFIRMATIVO_KEYWORDS)) {
    return {
      respuesta: "¿Sería en consultorio o a domicilio?",
      nuevoEstado: { fase: "agendando", paso: "modalidad" },
    };
  }

  // 7) Preguntas de precio / duracion (ya contestadas por el texto de bienvenida,
  // pero se repiten seguido).
  if (contieneAlguna(normalizado, DURACION_KEYWORDS) || contieneAlguna(normalizado, PRECIO_KEYWORDS)) {
    return { respuesta: PRECIO_DURACION_TEXT, nuevoEstado: { ...estado, fase: "conversando" } };
  }

  // 8) Cualquier intencion de agendar arranca el flujo de la cita.
  if (esIntencionAgendar(normalizado)) {
    return {
      respuesta: "¿Sería en consultorio o a domicilio?",
      nuevoEstado: { fase: "agendando", paso: "modalidad" },
    };
  }

  // 9) Menciona un dolor o molestia: respuesta tranquila + cierre directo.
  if (contieneAlguna(normalizado, SINTOMA_KEYWORDS)) {
    const parte = detectarParteCuerpo(normalizado);
    return {
      respuesta: `Ah ok, no se preocupe, debe ser algo sencillo con ${parte}. De cualquier forma, para salir de dudas de qué es exactamente, con el escaneo lo revisamos bien. ¿Para cuándo le gustaría agendar su cita?`,
      nuevoEstado: { fase: "agendando", paso: "modalidad" },
    };
  }

  // 10) No se reconocio nada -- se marca para que Master lo entrene.
  return {
    respuesta: "Mmm, no estoy seguro de cómo contestar eso todavía. Usa el botón de \"Enseñar respuesta\" de abajo para decirme qué debí haber dicho.",
    nuevoEstado: { ...estado, fase: "conversando" },
    nota: "sin_entrenar",
  };
}

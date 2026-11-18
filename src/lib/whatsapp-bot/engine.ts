import "server-only";
import { obtenerHorariosDisponibles, interpretarFecha, interpretarTurno, formatFechaBonita, formatearHora, buscarEnOpcionesOfrecidas, hoyCST, horaActualCST, type Turno } from "./disponibilidad";

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
  paso?: "modalidad" | "lugar" | "personas" | "dia" | "turno" | "hora" | "nombre";
  modalidad?: "CONSULTORIO" | "DOMICILIO";
  lugar?: string;
  personas?: string;
  dia?: string;
  fechaResuelta?: string; // "YYYY-MM-DD", cuando se pudo entender bien el dia
  turnoResuelto?: Turno;
  opcionesHorario?: string[]; // las horas que se le ofrecieron, para leer bien si contesta con un numero suelto
  hora?: string;
  esperaConfirmacionAgendar?: boolean;
}

export interface Correccion {
  disparador: string; // ya normalizado
  respuesta: string;
}

// Un "escrito" es el mensaje pre-llenado que Vic configura en sus
// anuncios de Facebook/Instagram (ej. "B3 - Hola, ¿podrían darme mas
// informacion?"). Sirven para que el bot sepa si el primer mensaje de
// una conversacion de verdad viene de un anuncio (y entonces contesta
// el saludo automatico) o no (ej. un mensaje de seguimiento de alguien
// que ya fue atendido antes, que no debe recibir el saludo generico).
export interface Anuncio {
  textoNormalizado: string; // ya normalizado y sin el codigo del inicio
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

// Distancia de edicion simple (cuantas letras hay que cambiar/agregar/
// quitar para convertir una palabra en otra) -- sirve para tolerar
// errores de dedo como "quiro" en vez de "quiero".
function distanciaEdicion(a: string, b: string): number {
  const filas = a.length + 1;
  const columnas = b.length + 1;
  const dp: number[][] = Array.from({ length: filas }, () => new Array(columnas).fill(0));
  for (let i = 0; i < filas; i++) dp[i][0] = i;
  for (let j = 0; j < columnas; j++) dp[0][j] = j;
  for (let i = 1; i < filas; i++) {
    for (let j = 1; j < columnas; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + costo);
    }
  }
  return dp[filas - 1][columnas - 1];
}

// Compara una palabra escrita contra una palabra "correcta", tolerando
// 1 o 2 errores de dedo segun que tan larga sea (para que no se
// disparen falsos positivos en palabras cortas).
function palabraSeParece(palabra: string, objetivo: string): boolean {
  if (palabra === objetivo) return true;
  const tolerancia = objetivo.length >= 6 ? 2 : 1;
  if (Math.abs(palabra.length - objetivo.length) > tolerancia) return false;
  return distanciaEdicion(palabra, objetivo) <= tolerancia;
}

function tieneAlgunaPalabraParecida(normalizado: string, objetivos: string[]): boolean {
  const tokens = normalizado.split(" ");
  return tokens.some((t) => objetivos.some((o) => palabraSeParece(t, o)));
}

const URGENCIA_KEYWORDS = ["dolor de pecho", "me duele el pecho", "duele el pecho", "falta de aire", "no puedo respirar", "me ahogo", "ahogo"];
const ORDEN_MEDICA_KEYWORDS = ["me dijo el doctor", "me indico el doctor", "me indico el medico", "me dijo el medico", "me mando a hacer", "me receto", "un tac", "hacerme un tac", "resonancia", "estudio de sangre", "analisis de sangre"];
const PRECIO_KEYWORDS = ["cuesta", "costo", "precio", "cuanto es", "cuanto vale"];
const DURACION_KEYWORDS = ["cuanto dura", "cuanto tarda", "cuanto tiempo", "dura el estudio", "tarda la cita", "tarda por persona"];
const AGENDAR_PALABRAS_ACCION = [
  "quiero", "quisiera", "necesito", "sacar", "saco", "pedir", "dar", "dame", "deme", "denme",
  "podria", "pudiera", "cuando", "donde", "como", "quien", "numero", "cual",
];
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
// Tambien tolera errores de dedo tipo "quiro" en vez de "quiero", muy
// comunes cuando la gente escribe rapido desde el celular.
function esIntencionAgendar(normalizado: string): boolean {
  if (normalizado.includes("agend") || normalizado.includes("como le hago")) return true;
  // "me interesa", "si me interesa", etc. -- no mencionan la palabra
  // "cita" pero ya es una persona lista para agendar.
  if (tieneAlgunaPalabraParecida(normalizado, ["interesa", "interesado", "interesada"])) return true;
  // "consulta"/"consultas" cuenta igual que "cita"/"citas" (ej. "para
  // una consulta") -- cuidado, esto NO debe disparar con "consultorio"
  // (son palabras distintas, por eso se compara por tolerancia y no
  // con un includes() que si las confundiria).
  const tieneCita = tieneAlgunaPalabraParecida(normalizado, ["cita", "citas", "consulta", "consultas"]);
  if (!tieneCita) return false;
  // Si el mensaje es cortito (ej. solo "cita", "una cita", "cita porfavor")
  // ya alcanza con que mencione la cita, sin necesitar una palabra de
  // accion aparte -- es la forma mas seca y comun de pedirla.
  if (normalizado.split(" ").length <= 3) return true;
  // Frases tipo "tendra cita para hoy", "si tengo consulta para el
  // jueves", "cita para el 27" -- es una forma muy comun de preguntar
  // si hay horario, y equivale a querer agendar.
  if (normalizado.includes("para")) return true;
  return tieneAlgunaPalabraParecida(normalizado, AGENDAR_PALABRAS_ACCION);
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

// Quita el codigo del inicio (si tiene) y normaliza, para poder
// comparar el mensaje que llega contra los "escritos" guardados sin
// que el codigo (que cambia de anuncio a anuncio) estorbe.
function quitarCodigoYNormalizar(mensaje: string): string {
  const sinCodigo = mensaje.trim().replace(/^([A-Za-z]\d{1,3})\s*[-,.]?\s*/, "");
  return normalizar(sinCodigo);
}

export function normalizarEscritoAnuncio(mensaje: string): string {
  return quitarCodigoYNormalizar(mensaje);
}

// Si no hay ningun escrito guardado todavia, se asume que CUALQUIER
// primer mensaje viene de un anuncio (asi se comportaba el bot antes
// de que existiera esta lista) -- para no romper nada mientras Vic
// todavia no ha subido ninguno. En cuanto haya al menos uno guardado,
// ya se exige que el mensaje coincida con alguno.
export function coincideConAnuncio(mensaje: string, anuncios: Anuncio[]): boolean {
  if (anuncios.length === 0) return true;
  const normalizado = quitarCodigoYNormalizar(mensaje);
  if (!normalizado) return false;
  return anuncios.some(
    (a) => normalizado === a.textoNormalizado || normalizado.includes(a.textoNormalizado) || a.textoNormalizado.includes(normalizado)
  );
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
    `• Día: ${estado.fechaResuelta ? formatFechaBonita(estado.fechaResuelta) : estado.dia ?? ""}`,
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

export async function generarRespuesta(args: {
  mensaje: string;
  estado: EstadoAgendado;
  correcciones: Correccion[];
  anuncios?: Anuncio[];
}): Promise<ResultadoRespuesta> {
  const { mensaje, estado, correcciones, anuncios = [] } = args;
  const normalizado = normalizar(mensaje);

  // 1) Primer mensaje de la conversacion.
  if (estado.fase === "inicio") {
    // Si no coincide con ningun escrito de anuncio guardado, es
    // probable que NO venga de hacer clic en un anuncio -- por
    // ejemplo, un mensaje de seguimiento de alguien que ya fue
    // atendido antes (ej. preguntando por la sal que le recomendaron).
    // En ese caso no se manda el saludo generico; se avisa para que
    // Vic lo revise el mismo.
    if (!coincideConAnuncio(mensaje, anuncios)) {
      return {
        respuesta: "⚠️ Este mensaje no coincide con ningún anuncio guardado. Puede que no venga de un clic a un anuncio de Facebook/Instagram (por ejemplo, un mensaje de seguimiento de alguien que ya atendiste) -- revísalo tú mismo en vez de contestar el saludo automático.",
        nuevoEstado: { fase: "conversando" },
        nota: "mensaje_no_de_anuncio",
      };
    }
    const codigo = detectarCodigoAnuncio(mensaje);
    return {
      respuesta: `🔊 [Aquí se manda el audio de bienvenida que ya tienes grabado]\n\n${WELCOME_TEXT}`,
      nuevoEstado: { fase: "conversando" },
      nota: codigo ? `Código de anuncio detectado: ${codigo}` : undefined,
    };
  }

  // El resto de las reglas (incluyendo el flujo de agendado) siempre
  // corren de todas formas, aunque haya una correccion ensenada --
  // asi lo que Master ensena solo cambia las PALABRAS de la
  // respuesta, nunca congela la conversacion a medias esperando el
  // siguiente mensaje.
  const resultadoBase = await calcularRespuestaBase(mensaje, normalizado, estado);

  // 2) Si ya le ensenaste exactamente que contestar ante este mensaje,
  // se usa ese texto -- pero el paso/estado que ya se calculo arriba
  // se respeta igual, para que la conversacion siga avanzando bien.
  const correccionExacta = correcciones.find((c) => c.disparador === normalizado);
  if (correccionExacta) {
    return { ...resultadoBase, respuesta: correccionExacta.respuesta, nota: "Respuesta aprendida" };
  }

  return resultadoBase;
}

// Resuelve el dia que pide la persona (sea en el paso "dia" normal, o
// porque cambio de opinion sobre el dia estando ya en el paso "hora" --
// ej. le ofrecimos horas para "hoy" y contesta "mejor para el viernes").
// Siempre limpia fechaResuelta/turnoResuelto/opcionesHorario/hora viejos,
// para que no se quede pegado un horario de un dia que ya no aplica.
async function manejarDia(estado: EstadoAgendado, textoDia: string, normalizadoDia: string): Promise<ResultadoRespuesta> {
  const fechaStr = interpretarFecha(normalizadoDia);

  // Si piden "hoy", ya no tiene caso preguntar manana o tarde -- puede
  // que ya sea tarde-noche y "manana" ya no exista. Se buscan horarios
  // de lo que queda del dia directamente.
  if (fechaStr && fechaStr === hoyCST()) {
    const turnoImplicito: Turno = horaActualCST() >= 14 ? "tarde" : "manana";
    const horarios = await obtenerHorariosDisponibles(fechaStr, estado.modalidad ?? "CONSULTORIO", null);
    if (horarios.length === 0) {
      const nuevoEstado: EstadoAgendado = {
        ...estado,
        paso: "dia",
        dia: textoDia.trim(),
        fechaResuelta: undefined,
        turnoResuelto: undefined,
        opcionesHorario: undefined,
        hora: undefined,
      };
      return { respuesta: "Mmm, ya no tengo horario libre para hoy. ¿Para qué otro día le gustaría agendar?", nuevoEstado };
    }
    const opcionesLista = horarios.slice(0, 4);
    const nuevoEstado: EstadoAgendado = {
      ...estado,
      paso: "hora",
      dia: textoDia.trim(),
      fechaResuelta: fechaStr,
      turnoResuelto: turnoImplicito,
      opcionesHorario: opcionesLista,
      hora: undefined,
    };
    return { respuesta: `Tengo disponible hoy: ${opcionesLista.join(", ")}. ¿Cuál le queda mejor?`, nuevoEstado };
  }

  const nuevoEstado: EstadoAgendado = {
    ...estado,
    paso: "turno",
    dia: textoDia.trim(),
    fechaResuelta: undefined,
    turnoResuelto: undefined,
    opcionesHorario: undefined,
    hora: undefined,
  };
  return { respuesta: "¿Le gustaría por la mañana o por la tarde?", nuevoEstado };
}

async function calcularRespuestaBase(
  mensaje: string,
  normalizado: string,
  estado: EstadoAgendado
): Promise<ResultadoRespuesta> {
  // 3) Si estamos a la mitad de agendar una cita, seguimos la pregunta
  // que sigue en ese flujo.
  if (estado.fase === "agendando" && estado.paso) {
    switch (estado.paso) {
      case "modalidad": {
        const esDomicilio = normalizado.includes("domicilio");
        const esConsultorio = normalizado.includes("consultorio");
        if (!esDomicilio && !esConsultorio) {
          // No quedo claro si es consultorio o a domicilio -- por
          // ejemplo, a veces contestan con el dia ("para el jueves")
          // en vez de esto, sobre todo cuando el cierre de un mensaje
          // anterior fue "para cuando le gustaria agendar su cita".
          // Antes se adivinaba CONSULTORIO por default, pero eso
          // desalineaba todo el flujo despues (el "lugar" quedaba con
          // texto que en realidad era la respuesta de otra pregunta).
          // Mejor se vuelve a preguntar sin avanzar -- pero si lo que
          // dijeron si se puede leer como un dia, se guarda para no
          // tener que volver a preguntarlo mas adelante.
          const posibleDia = interpretarFecha(normalizado);
          const nuevoEstado: EstadoAgendado = posibleDia ? { ...estado, dia: mensaje.trim() } : estado;
          return { respuesta: "¿Sería en consultorio o a domicilio?", nuevoEstado };
        }
        const modalidad: "CONSULTORIO" | "DOMICILIO" = esDomicilio ? "DOMICILIO" : "CONSULTORIO";

        // Si ya dijeron el consultorio junto con la modalidad (ej.
        // "consultorio san blas", "consultorio mitras"), no hace falta
        // volver a preguntar cual es -- se salta directo a personas.
        if (modalidad === "CONSULTORIO") {
          const esSanBlas = normalizado.includes("san blas");
          const esMitras = normalizado.includes("mitras");
          if (esSanBlas || esMitras) {
            const lugar = esSanBlas ? "San Blas" : "Mitras";
            const nuevoEstado: EstadoAgendado = { ...estado, paso: "personas", modalidad, lugar };
            return { respuesta: "¿Cuántas personas serían?", nuevoEstado };
          }
        }

        const nuevoEstado: EstadoAgendado = { ...estado, paso: "lugar", modalidad };
        return { respuesta: siguientePreguntaLugar(modalidad), nuevoEstado };
      }
      case "lugar": {
        const nuevoEstado: EstadoAgendado = { ...estado, paso: "personas", lugar: mensaje.trim() };
        return { respuesta: "¿Cuántas personas serían?", nuevoEstado };
      }
      case "personas": {
        const estadoConPersonas: EstadoAgendado = { ...estado, personas: mensaje.trim() };
        if (estadoConPersonas.dia) {
          // Ya habian dicho el dia antes (ej. contestaron con un dia
          // cuando se les pregunto consultorio/domicilio) -- se usa
          // ese mismo en vez de volver a preguntarlo.
          return await manejarDia(estadoConPersonas, estadoConPersonas.dia, normalizar(estadoConPersonas.dia));
        }
        const nuevoEstado: EstadoAgendado = { ...estadoConPersonas, paso: "dia" };
        return { respuesta: "¿Para qué día le gustaría agendar?", nuevoEstado };
      }
      case "dia": {
        return await manejarDia(estado, mensaje, normalizado);
      }
      case "turno": {
        const fechaStr = interpretarFecha(normalizar(estado.dia ?? ""));
        const turno = interpretarTurno(normalizado);
        if (!fechaStr) {
          // No se pudo entender que dia es -- seguimos sin bloquear la
          // conversacion, nada mas sin el horario sugerido.
          const nuevoEstado: EstadoAgendado = { ...estado, paso: "hora" };
          return { respuesta: "¿A qué hora le quedaría mejor?", nuevoEstado };
        }
        const horarios = await obtenerHorariosDisponibles(fechaStr, estado.modalidad ?? "CONSULTORIO", turno);
        if (horarios.length === 0) {
          const nuevoEstado: EstadoAgendado = { ...estado, paso: "dia" };
          return {
            respuesta: "Mmm, no tengo horario libre ese día. ¿Para qué otro día le gustaría agendar?",
            nuevoEstado,
          };
        }
        const opcionesLista = horarios.slice(0, 4);
        const nuevoEstado: EstadoAgendado = { ...estado, paso: "hora", fechaResuelta: fechaStr, turnoResuelto: turno, opcionesHorario: opcionesLista };
        return { respuesta: `Tengo disponible: ${opcionesLista.join(", ")}. ¿Cuál le queda mejor?`, nuevoEstado };
      }
      case "hora": {
        // Si contesta sin ningun numero pero mencionando otro dia (ej.
        // le ofrecimos horarios para "hoy" y dice "mejor para el
        // viernes"), es que cambio de opinion sobre el DIA, no que esta
        // contestando la hora -- hay que volver a resolver el dia
        // completo (y los horarios que le podemos ofrecer ese dia) en
        // vez de guardar ese texto como si fuera la hora.
        const tieneDigito = /\d/.test(mensaje);
        if (!tieneDigito && interpretarFecha(normalizado)) {
          return await manejarDia(estado, mensaje, normalizado);
        }
        const horaBonita = buscarEnOpcionesOfrecidas(mensaje, estado.opcionesHorario) ?? formatearHora(mensaje, estado.turnoResuelto ?? null);
        const nuevoEstado: EstadoAgendado = { ...estado, paso: "nombre", hora: horaBonita };
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

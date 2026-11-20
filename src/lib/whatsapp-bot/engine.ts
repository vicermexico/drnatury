import "server-only";
import { obtenerHorariosDisponibles, interpretarFecha, interpretarTurno, formatFechaBonita, formatearHora, buscarEnOpcionesOfrecidas, buscarHoraExactaEnOpciones, extraerHoraExplicita, sumarDias, muestrearHorarios, hoyCST, horaActualCST, type Turno } from "./disponibilidad";

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
  paso?: "modalidad" | "lugar" | "personas" | "dia" | "turno" | "hora" | "nombre" | "celular";
  modalidad?: "CONSULTORIO" | "DOMICILIO";
  lugar?: string;
  personas?: string;
  dia?: string;
  fechaResuelta?: string; // "YYYY-MM-DD", cuando se pudo entender bien el dia
  turnoResuelto?: Turno;
  // Cuando ya dijeron "por la mañana"/"por la tarde" en un mensaje que
  // TODAVIA no traia el dia (ej. primero dicen "por la tarde" y el dia
  // lo contestan hasta el siguiente mensaje), se guarda aqui para no
  // volver a preguntarlo en cuanto se resuelva el dia -- ver manejarDia.
  turnoPendiente?: Turno;
  // Cuando ya dijeron una hora explicita (ej. "a las 5pm") en un
  // mensaje que TODAVIA no traia el dia completo, se guarda el texto
  // tal cual aqui -- en cuanto se resuelven los horarios libres del
  // dia (ver manejarDia), se intenta agendar esa hora derecho (si de
  // verdad esta libre) en vez de preguntar otra vez "cual hora le
  // queda mejor" ignorando lo que ya habia dicho.
  horaPendiente?: string;
  opcionesHorario?: string[]; // las horas que se le ofrecieron, para leer bien si contesta con un numero suelto
  hora?: string;
  nombre?: string;
  celular?: string; // numero de WhatsApp para el recordatorio -- en WhatsApp real ya se sabe solo, pero en el chat web hay que pedirlo
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

export const TRATAMIENTO_TEXT = `Nosotros damos tratamientos 100% naturales, son compuestos herbolarios. Los costos son de $350 a $490, dependiendo de lo que se necesite -- a veces ni siquiera se llega a necesitar tratamiento, porque basta con mejorar la alimentación. Eso lo vemos bien con el escaneo y en la consulta.`;

// Cuando preguntan si se les va a quitar, si tiene solucion, si sabran
// que es, si les pueden ayudar, etc. -- no nos adelantamos a decir que
// si o que no sin haber visto nada todavia.
export const PRONOSTICO_TEXT = `Claro que sí le podemos ayudar, pero no nos gusta adelantarnos a decirle algo sin haber visto primero de qué se trata -- para eso es el escaneo, para ver bien de dónde viene.`;

// Una ubicacion que Master guardo desde el panel (ver
// /master/asistente-whatsapp/ubicaciones) -- esta pantalla es
// independiente de donde la plataforma administra las sucursales
// (branches), asi que la direccion/GPS que el bot manda es la que
// Master escribio AQUI, no la de otra pantalla. Puede traer la
// direccion de texto, el GPS exacto (parado fisicamente en el lugar),
// o los dos -- si trae los dos, el link usa el GPS (mas exacto).
export interface Ubicacion {
  nombre: string; // tal cual lo escribio Master (ej. "San Blas")
  nombreNormalizado: string; // ya normalizado, para comparar contra el mensaje
  direccion?: string | null;
  lat?: number | null;
  lng?: number | null;
}

function enlaceMapaDeUbicacion(u: Ubicacion): string | null {
  if (u.lat != null && u.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${u.lat},${u.lng}`;
  }
  if (u.direccion) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(u.direccion)}`;
  }
  return null;
}

// Si preguntan por la ubicacion mencionando un lugar en especifico que
// Master ya guardo (ej. "mandame la ubicacion de San Blas"), se manda
// solo esa -- si mencionan varias (ej. "...de San Blas y de Mitras"),
// se mandan esas; si no especifican ninguna (ej. "mandame la
// ubicacion", a secas), se mandan todas las que haya guardadas.
function respuestaUbicacion(normalizado: string, ubicaciones: Ubicacion[]): string {
  if (ubicaciones.length === 0) {
    return "Ahorita no tengo guardada esa ubicación, en un momento se la paso.";
  }
  const mencionadas = ubicaciones.filter((u) => normalizado.includes(u.nombreNormalizado));
  const aMandar = mencionadas.length > 0 ? mencionadas : ubicaciones;
  return aMandar
    .map((u) => {
      const link = enlaceMapaDeUbicacion(u);
      const direccion = u.direccion ? `${u.direccion}\n` : "";
      return `📍 ${u.nombre}: ${direccion}${link ?? ""}`.trim();
    })
    .join("\n\n");
}

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
const TRATAMIENTO_KEYWORDS = [
  "tratamiento", "tratamientos",
  "medicamento", "medicamentos", "medicina", "medicinas",
  "receta", "recetan", "recetas",
];
const PRONOSTICO_KEYWORDS = [
  "se me quite", "se le quite", "se te quite",
  "tendra solucion", "tiene solucion", "hay solucion",
  "sabran que es", "sabran si", "sabran lo que es",
  "podria ayudar", "pueden ayudar", "me pueden ayudar", "me podria ayudar",
  "tiene cura", "se cura", "tiene remedio",
  "cree que si", "creen que si", "crees que si",
];
// Cosas especificas que si revisa el escaneo -- cuando preguntan si
// ven tal organo o condicion (ej. "pueden revisar la prostata?"), se
// les confirma que si, mencionando lo que preguntaron, en vez de la
// respuesta generica de "con gusto le ayudo".
const ESCANEO_TEMAS_KEYWORDS = [
  "prostata", "prostatitis", "hiperplasia prostatica",
  "higado graso", "higado", "vesicula", "pancreas",
  "diabetes", "glucosa",
  "nervio cerebral", "cerebro",
  "hormonas", "anemia", "vitaminas",
  "huesos", "desgaste", "desgastes",
  "acido urico", "trigliceridos",
  "osteoporosis", "artritis", "dolores musculares", "dolor muscular",
  "sistema digestivo", "vista",
];

function detectarTemaEscaneo(normalizado: string): string | null {
  return ESCANEO_TEMAS_KEYWORDS.find((t) => normalizado.includes(t)) ?? null;
}

const AGENDAR_PALABRAS_ACCION = [
  "quiero", "quisiera", "necesito", "sacar", "saco", "pedir", "dar", "dame", "deme", "denme",
  "podria", "pudiera", "cuando", "donde", "como", "quien", "numero", "cual",
];
const AFIRMATIVO_KEYWORDS = ["si", "claro", "va", "sale", "dale", "esta bien", "de acuerdo", "porfavor", "por favor"];
const ACK_KEYWORDS = ["ok", "okay", "oka", "vale", "gracias", "entendido", "perfecto", "excelente", "genial", "bien"];
const BENDICION_KEYWORDS = ["dios le bendiga", "dios lo bendiga", "dios te bendiga", "bendiciones", "que dios la bendiga", "que dios lo bendiga", "que este bien"];
const SINTOMA_KEYWORDS = ["duele", "dolor", "molestia", "me siento", "siento", "adormecid", "hormigueo", "me canso", "cansancio", "mareo"];
const UBICACION_KEYWORDS = ["ubicacion", "direccion", "donde queda", "donde quedan", "donde estan", "donde esta", "como llego", "mapa", "localizacion"];

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
  { palabra: "panza", frase: "su panza" },
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

// Ademas de las frases que ya cuenta esIntencionAgendar (cita, agendar,
// me interesa, etc.), si de plano ya dice derecho la modalidad y/o el
// lugar JUNTO CON algo de dia/turno/hora (ej. "consultorio de San
// Blas por la tarde 5pm porfavor", sin decir "quiero cita" ni nada
// parecido) tambien es clarisimo que quiere agendar -- es muy comun
// que contesten asi derecho despues de leer el mensaje de bienvenida,
// sin repetir la palabra "cita". Pero mencionar el lugar SOLO, sin
// nada de dia/turno/hora (ej. "¿dónde queda San Blas?", o de plano
// algo sin relacion, "voy a pasar a San Blas por otra cosa"), no basta
// -- ahi si puede ser una pregunta o mencion casual, no un intento de
// agendar.
function pareceIntencionAgendar(mensaje: string, normalizado: string): boolean {
  if (esIntencionAgendar(normalizado)) return true;
  if (!detectarModalidadYLugar(normalizado)) return false;
  return interpretarFecha(normalizado) !== null || interpretarTurno(normalizado) !== null || extraerHoraExplicita(mensaje) !== null;
}

function detectarParteCuerpo(normalizado: string): string {
  const match = PARTES_CUERPO.find((p) => normalizado.includes(p.palabra));
  return match ? match.frase : "eso";
}

// Respuesta cuando la persona menciona un dolor o molestia. Antes decia
// "debe ser algo sencillo", pero eso suena a que se le resta importancia
// a lo que sea que haya dicho (incluso algo serio, ej. "tengo mucho
// sangrado") -- ahora transmite la misma calma sin adelantar un
// diagnostico, y deja claro que el escaneo es justo para saber que es.
function respuestaSintoma(parte: string): string {
  return `Entiendo, a veces este tipo de molestias con ${parte} está ocasionado por algo fácil de remediar. No se preocupe, que vamos a dar con la raíz del problema y la mejor solución, pero primero hay que hacer el escaneo para tener un buen diagnóstico.`;
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

// Si no dan un numero (ej. "pues yo, mi mama y mis hijas" en vez de
// "4"), antes se guardaba el texto tal cual y al final se contaba como
// 1 sola persona (parseInt de ese texto da NaN). Ahora, sin numero, se
// cuentan cuantas personas se mencionan por separado (separadas por
// comas o "y") -- ese mismo ejemplo da 3: "yo" / "mi mama" / "mis hijas".
function contarPersonas(mensaje: string): number {
  const conNumero = mensaje.match(/\d+/);
  if (conNumero) return Math.max(1, parseInt(conNumero[0], 10));
  // Muy seguido la respuesta trae una frase de relleno antes de la
  // lista de personas (ej. "vamos hacer mi mama mi tia y yo", "seriamos
  // mi esposa y yo") -- sin quitarla, esa frase se contaba como si
  // fuera una persona mas (dando 4 en vez de 3 en ese ejemplo).
  const sinRelleno = mensaje.replace(
    /^\s*(vamos a ser|vamos a hacer|vamos hacer|vamos ser|vamos a ir|iriamos|seriamos|somos)\b\s*/i,
    ""
  );
  // Ej. "yo mi mama y mi hermana" -- falta la coma entre "yo" y "mi
  // mama", pero igual son 3 personas distintas. Donde aparezca "yo",
  // "mi", "tu" o "su" pegado a la palabra anterior (sin coma ni "y"),
  // se trata como el inicio de otra persona.
  const PRONOMBRE_INICIO = /\s+(mi|tu|su)\b/gi;
  const partes = sinRelleno
    .split(/,|\s+y\s+/i)
    .flatMap((parte) => parte.replace(PRONOMBRE_INICIO, "|$1").split("|"))
    .map((p) => p.trim())
    .filter(Boolean);
  return Math.max(1, partes.length);
}

const PALABRAS_NUMERO: Record<string, number> = {
  uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
};

// Lee cuantas personas serian, pero SOLO cuando el numero (o la
// palabra: "dos", "tres", etc.) viene bien pegado a la palabra
// "persona(s)" (ej. "2 personas", "vamos a ser 2 personas"). A
// diferencia de contarPersonas (que se usa cuando SI se esta
// contestando derecho la pregunta "¿cuantas personas serian?", ahi
// cualquier numero en el mensaje vale), aqui no se puede usar
// cualquier numero que aparezca en el mensaje inicial completo, porque
// facil se cruza con la hora (ej. "a las 5pm") o el dia (ej. "el 26
// a las 2"). Si no se menciona asi de claro, regresa null -- no se
// adivina.
function detectarPersonasExplicitas(normalizado: string): number | null {
  const conDigito = normalizado.match(/\b([1-9]|10)\s*personas?\b/);
  if (conDigito) return parseInt(conDigito[1], 10);
  const conPalabra = normalizado.match(/\b(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+personas?\b/);
  if (conPalabra) return PALABRAS_NUMERO[conPalabra[1]];
  return null;
}

// Municipios donde de verdad se da el servicio a domicilio -- si
// dicen uno que no esta aqui (ej. Guadalupe), no se debe dejar seguir
// agendando, hay que avisarle y volver a preguntar. Se guarda junto
// con su forma "bonita" (con mayusculas y acentos) para poder usarla
// directo como "lugar" cuando se detecta mencionado (ver
// detectarModalidadYLugar) sin tener que volver a preguntarlo.
const MUNICIPIOS_DOMICILIO: { normalizado: string; bonito: string }[] = [
  { normalizado: "garcia", bonito: "García" },
  { normalizado: "santa catarina", bonito: "Santa Catarina" },
  { normalizado: "san pedro", bonito: "San Pedro" },
  { normalizado: "escobedo", bonito: "Escobedo" },
  { normalizado: "carmen", bonito: "Carmen" },
  { normalizado: "monterrey", bonito: "Monterrey" },
  { normalizado: "san nicolas", bonito: "San Nicolás" },
  { normalizado: "apodaca", bonito: "Apodaca" },
];

function municipioDomicilioValido(mensaje: string): boolean {
  const normalizado = normalizar(mensaje);
  return MUNICIPIOS_DOMICILIO.some((m) => normalizado.includes(m.normalizado));
}

function buscarMunicipioDomicilio(normalizado: string): string | null {
  const match = MUNICIPIOS_DOMICILIO.find((m) => normalizado.includes(m.normalizado));
  return match ? match.bonito : null;
}

// Municipios cercanos (area metropolitana de Monterrey) a los que
// todavia NO se da servicio a domicilio -- para distinguir cuando de
// verdad dijeron un municipio que no se cubre (ej. "Guadalupe") de
// cuando no dijeron ningun municipio en claro (ej. mencionaron una
// colonia o una calle, como "valle de Lincoln sector Mitras", que no
// es el nombre de ningun municipio). En el primer caso se le avisa que
// ese municipio no se cubre; en el segundo, mejor se le vuelve a
// preguntar el municipio en vez de asumir que ya contesto algo
// invalido. No hace falta la lista completa de los +2400 municipios
// de México -- con los de esta zona alcanza para casi todos los casos
// reales, ya que los pacientes son de por aqui.
const MUNICIPIOS_CERCANOS_NO_CUBIERTOS = [
  "guadalupe",
  "juarez",
  "cadereyta",
  "santiago",
  "pesqueria",
  "zuazua",
  "salinas victoria",
  "cienega de flores",
  "abasolo",
  "hidalgo",
  "allende",
  "montemorelos",
  "linares",
  "china",
  "los ramones",
  "marin",
];

function municipioCercanoNoCubierto(mensaje: string): boolean {
  const normalizado = normalizar(mensaje);
  return MUNICIPIOS_CERCANOS_NO_CUBIERTOS.some((m) => normalizado.includes(m));
}

function siguientePreguntaLugar(modalidad: "CONSULTORIO" | "DOMICILIO"): string {
  return modalidad === "CONSULTORIO"
    ? "¿Sería en Mitras o en San Blas?"
    : "¿En qué municipio sería (García, Santa Catarina, San Pedro, Escobedo, Carmen, Monterrey, San Nicolás o Apodaca)?";
}

// Si el mensaje ya deja claro, de un modo u otro, que modalidad (y a
// veces hasta el lugar) quiere, se puede saber sin tener que
// preguntarlo. No solo cuenta decir la palabra "consultorio" o
// "domicilio" -- mencionar uno de los consultorios (San Blas, Mitras)
// o uno de los municipios de domicilio (García, Monterrey, etc.)
// tambien lo deja igual de claro, aunque no se diga la palabra exacta
// (ej. "la dirección que me queda en San Blas" ya implica
// CONSULTORIO). Si el mensaje mezcla senales de las dos modalidades a
// la vez (raro, pero puede pasar), se considera ambiguo y se pregunta
// igual que antes, para no adivinar mal.
function detectarModalidadYLugar(normalizado: string): { modalidad: "CONSULTORIO" | "DOMICILIO"; lugar?: string } | null {
  const esSanBlas = normalizado.includes("san blas");
  const esMitras = normalizado.includes("mitras");
  const indicaConsultorio = normalizado.includes("consultorio") || esSanBlas || esMitras;
  const municipio = buscarMunicipioDomicilio(normalizado);
  const indicaDomicilio = normalizado.includes("domicilio") || !!municipio;

  if (indicaConsultorio && indicaDomicilio) return null;
  if (indicaConsultorio) {
    return { modalidad: "CONSULTORIO", lugar: esSanBlas ? "San Blas" : esMitras ? "Mitras" : undefined };
  }
  if (indicaDomicilio) {
    return { modalidad: "DOMICILIO", lugar: municipio ?? undefined };
  }
  return null;
}

// Arranca el flujo de agendar cita. Si el mensaje que lo disparo ya
// deja claro la modalidad (y a veces el lugar), nos saltamos esas
// preguntas en vez de preguntar algo que ya contestaron. Igual, si ya
// menciona para que dia (ej. "para la proxima semana el sabado") o
// cuantas personas (ej. "vamos a ser 2 personas"), se guarda eso --
// no se pregunta de nuevo algo que ya contestaron en este mismo
// mensaje. Es async porque, si ya se sabe TODO (modalidad, lugar,
// personas Y dia de un jalon), se reusa manejarDia para ya ofrecer
// horario de una vez, igual que si lo hubiera contestado paso a paso.
async function iniciarFlujoAgendado(normalizado: string, mensaje: string): Promise<ResultadoRespuesta> {
  const detectado = detectarModalidadYLugar(normalizado);
  const dia = interpretarFecha(normalizado) ? mensaje.trim() : undefined;
  // Si ya dicen "por la mañana"/"por la tarde" pero TODAVIA no el dia
  // (ej. "consultorio San Blas por la tarde", sin decir para cuando),
  // se guarda para no volver a preguntarlo en cuanto contesten el dia
  // en otro mensaje aparte -- si el dia SI viene en este mismo mensaje,
  // no hace falta guardarlo aqui porque manejarDia ya lo lee derecho
  // del mismo texto.
  const turnoPendiente = !dia ? interpretarTurno(normalizado) ?? undefined : undefined;
  // Si ya dijeron una hora explicita (ej. "5pm") desde este primer
  // mensaje, se guarda para intentar agendarla derecho en cuanto se
  // sepa el dia (ver manejarDia) -- a diferencia de turnoPendiente, se
  // guarda aunque el dia SI venga en este mismo mensaje, porque
  // manejarDia nunca reserva la hora exacta por su cuenta, solo
  // ofrece la lista para escoger.
  const horaPendiente = extraerHoraExplicita(mensaje) ? mensaje.trim() : undefined;
  if (!detectado) {
    return {
      respuesta: "¿Sería en consultorio o a domicilio?",
      nuevoEstado: {
        fase: "agendando",
        paso: "modalidad",
        ...(dia ? { dia } : {}),
        ...(turnoPendiente ? { turnoPendiente } : {}),
        ...(horaPendiente ? { horaPendiente } : {}),
      },
    };
  }
  const { modalidad, lugar } = detectado;
  if (!lugar) {
    return {
      respuesta: siguientePreguntaLugar(modalidad),
      nuevoEstado: {
        fase: "agendando",
        paso: "lugar",
        modalidad,
        ...(dia ? { dia } : {}),
        ...(turnoPendiente ? { turnoPendiente } : {}),
        ...(horaPendiente ? { horaPendiente } : {}),
      },
    };
  }

  const personas = detectarPersonasExplicitas(normalizado);
  if (personas == null) {
    return {
      respuesta: "¿Cuántas personas serían?",
      nuevoEstado: {
        fase: "agendando",
        paso: "personas",
        modalidad,
        lugar,
        ...(dia ? { dia } : {}),
        ...(turnoPendiente ? { turnoPendiente } : {}),
        ...(horaPendiente ? { horaPendiente } : {}),
      },
    };
  }

  const estadoConPersonas: EstadoAgendado = {
    fase: "agendando",
    modalidad,
    lugar,
    personas: String(personas),
    ...(dia ? { dia } : {}),
    ...(turnoPendiente ? { turnoPendiente } : {}),
    ...(horaPendiente ? { horaPendiente } : {}),
  };
  if (dia) {
    return manejarDia(estadoConPersonas, dia, normalizar(dia));
  }
  return { respuesta: "¿Para qué día le gustaría agendar?", nuevoEstado: { ...estadoConPersonas, paso: "dia" } };
}

// Para repetir la pregunta del paso en el que ya se estaba, despues de
// contestar una duda de informacion general (precio, duracion,
// tratamiento) a la mitad del flujo de agendar -- sin esto, el mensaje
// de la duda se tomaba como si fuera la respuesta a esa pregunta (ej.
// "pero dan tratamiento" se tomaba como que si querian agendar).
function preguntaActualDelPaso(estado: EstadoAgendado): string {
  switch (estado.paso) {
    case "modalidad":
      return "¿Sería en consultorio o a domicilio?";
    case "lugar":
      return siguientePreguntaLugar(estado.modalidad ?? "CONSULTORIO");
    case "personas":
      return "¿Cuántas personas serían?";
    case "dia":
      return "¿Para qué día le gustaría agendar?";
    case "turno":
      return "¿Le gustaría por la mañana o por la tarde?";
    case "hora":
      return estado.opcionesHorario?.length
        ? `¿Cuál de estas horas le queda mejor: ${muestrearHorarios(estado.opcionesHorario).join(", ")}?`
        : "¿A qué hora le quedaría mejor?";
    case "nombre":
      return "¿A qué nombre le agendo la cita?";
    case "celular":
      return "¿A qué número de WhatsApp le mandamos el recordatorio de su cita?";
    default:
      return "¿Sería en consultorio o a domicilio?";
  }
}

function construirResumenAgendado(
  estado: EstadoAgendado,
  nombre: string,
  celular: string
): { texto: string; datos: ResumenAgendado } {
  const personasNum = Math.max(1, parseInt(estado.personas ?? "1", 10) || 1);
  const costoPorPersona = estado.modalidad === "DOMICILIO" ? 399 : 199;
  const costoTotal = personasNum * costoPorPersona;
  const lineaConsultorio = estado.modalidad === "CONSULTORIO" ? `Si, ${estado.lugar ?? ""}`.trim() : "No";
  const lineaDomicilio = estado.modalidad === "DOMICILIO" ? `Si, ${estado.lugar ?? ""}`.trim() : "No";
  const diaBonito = estado.fechaResuelta ? formatFechaBonita(estado.fechaResuelta) : estado.dia ?? "";
  // Ademas de lo "bonito" para mostrar en el chat, se guarda la fecha/hora
  // en formato exacto (no texto libre) para poder registrar la cita de
  // verdad en la plataforma sin tener que volver a interpretar el texto.
  const horaExplicita = extraerHoraExplicita(estado.hora ?? "");
  const hora24 = horaExplicita
    ? `${String(horaExplicita.hora24).padStart(2, "0")}:${String(horaExplicita.minuto).padStart(2, "0")}`
    : null;

  const texto = [
    "Agendado",
    "",
    `• Nombre: ${nombre}`,
    `• Celular: ${celular}`,
    `• Día: ${diaBonito}`,
    `• Hora: ${estado.hora ?? ""}`,
    "• Lugar:",
    `  ▪️︎ CONSULTORIO ${lineaConsultorio}`,
    `  ▪️︎ DOMICILIO ${lineaDomicilio}`,
    `• # Personas: ${personasNum}`,
    `• COSTO TOTAL $${costoTotal}`,
  ].join("\n");

  return {
    texto,
    datos: {
      nombre,
      celular,
      dia: diaBonito,
      hora: estado.hora ?? "",
      modalidad: estado.modalidad === "DOMICILIO" ? "A domicilio" : "En consultorio",
      lugar: estado.lugar,
      personas: personasNum,
      costoTotal,
      // Campos "crudos" (no para mostrar) que usa el endpoint publico para
      // registrar la cita de verdad en la plataforma.
      modalidadCodigo: estado.modalidad ?? "CONSULTORIO",
      fechaISO: estado.fechaResuelta ?? null,
      hora24,
    },
  };
}

export interface ResumenAgendado {
  nombre: string;
  celular: string;
  dia: string;
  hora: string;
  modalidad: string;
  lugar?: string;
  personas: number;
  costoTotal: number;
  // "Crudos", no se muestran en el chat -- el endpoint publico los usa
  // para registrar la cita real en la plataforma (ver crearCitaRapida).
  modalidadCodigo: "CONSULTORIO" | "DOMICILIO";
  fechaISO: string | null;
  hora24: string | null;
}

// Un mensaje de la serie de bienvenida que Master arma desde el panel
// (/master/asistente-whatsapp) -- puede ser un audio grabado por Master
// o un texto, en el orden que el mismo decida.
export interface BienvenidaItem {
  tipo: "texto" | "audio";
  contenido: string; // el texto en si, o la URL del audio
}

export interface ResultadoRespuesta {
  respuesta: string;
  nuevoEstado: EstadoAgendado;
  nota?: string;
  audioUrl?: string;
  // Se llena solo en el primer mensaje (el saludo de bienvenida) -- el
  // chat lo manda como varios mensajes seguidos, en vez de uno solo,
  // respetando el orden que Master armo.
  mensajesBienvenida?: BienvenidaItem[];
  // Se llena solo en el mensaje donde se termina de agendar -- lo usa el
  // chat publico para ofrecer un boton de "confirmar por WhatsApp" con
  // estos datos ya escritos en el mensaje.
  agendado?: ResumenAgendado;
}

// El audio de bienvenida real que Vic ya tiene grabado (lo mismo que
// manda siempre de entrada en WhatsApp, antes del texto) -- queda solo
// como respaldo por si todavia no hay nada configurado en la tabla
// whatsapp_bot_bienvenida.
export const WELCOME_AUDIO_URL = "/audio/bienvenida.mp3";

export async function generarRespuesta(args: {
  mensaje: string;
  estado: EstadoAgendado;
  correcciones: Correccion[];
  anuncios?: Anuncio[];
  bienvenida?: BienvenidaItem[];
  // Ubicaciones (pines de GPS) que Master ya guardo desde el panel --
  // ver /master/asistente-whatsapp/ubicaciones.
  ubicaciones?: Ubicacion[];
  // true cuando quien contesta es un paciente de verdad (chat publico
  // /demo-whatsapp) -- ahi el bot NUNCA debe sonar como que no sabe que
  // contestar, ni mencionar nada interno (botones de "ensenar", avisos
  // para que Vic revise). En el chat de entrenamiento de Master
  // (canalPublico=false, el valor de siempre) si se queda igual, porque
  // esos avisos son justo para que Master sepa que hay que entrenarlo.
  canalPublico?: boolean;
}): Promise<ResultadoRespuesta> {
  const { mensaje, estado, correcciones, anuncios = [], bienvenida = [], ubicaciones = [], canalPublico = false } = args;
  const normalizado = normalizar(mensaje);

  // 1) Primer mensaje de la conversacion.
  if (estado.fase === "inicio") {
    // Si no coincide con ningun escrito de anuncio guardado, es
    // probable que NO venga de hacer clic en un anuncio -- por
    // ejemplo, un mensaje de seguimiento de alguien que ya fue
    // atendido antes (ej. preguntando por la sal que le recomendaron).
    // En ese caso no se manda el saludo generico; se avisa para que
    // Vic lo revise el mismo (solo tiene sentido en el chat de
    // entrenamiento -- a un paciente real nunca se le dice esto).
    if (!coincideConAnuncio(mensaje, anuncios) && !canalPublico) {
      return {
        respuesta: "⚠️ Este mensaje no coincide con ningún anuncio guardado. Puede que no venga de un clic a un anuncio de Facebook/Instagram (por ejemplo, un mensaje de seguimiento de alguien que ya atendiste) -- revísalo tú mismo en vez de contestar el saludo automático.",
        nuevoEstado: { fase: "conversando" },
        nota: "mensaje_no_de_anuncio",
      };
    }
    // Si el primer mensaje YA es una intencion clara de agendar (ej.
    // el mensaje fijo "Quisiera agendar mi cita" del boton "Agenda tu
    // cita" en la pagina de inicio), nos saltamos el saludo de
    // bienvenida y vamos directo a la pregunta de consultorio/
    // domicilio -- el saludo de bienvenida es para cuando entran
    // pidiendo informacion (ej. el mensaje de los anuncios), no cuando
    // ya saben que quieren agendar.
    if (pareceIntencionAgendar(mensaje, normalizado)) {
      return iniciarFlujoAgendado(normalizado, mensaje);
    }
    const codigo = detectarCodigoAnuncio(mensaje);
    const serieBienvenida: BienvenidaItem[] =
      bienvenida.length > 0
        ? bienvenida
        : [
            { tipo: "audio", contenido: WELCOME_AUDIO_URL },
            { tipo: "texto", contenido: WELCOME_TEXT },
          ];
    return {
      // Se deja tambien en "respuesta" (solo el texto, unido) por si algo
      // mas adelante necesita leerlo de un jalon -- lo que de verdad
      // manda el chat es "mensajesBienvenida", uno por uno.
      respuesta: serieBienvenida
        .filter((m) => m.tipo === "texto")
        .map((m) => m.contenido)
        .join("\n\n"),
      nuevoEstado: { fase: "conversando" },
      nota: codigo ? `Código de anuncio detectado: ${codigo}` : undefined,
      mensajesBienvenida: serieBienvenida,
    };
  }

  // El resto de las reglas (incluyendo el flujo de agendado) siempre
  // corren de todas formas, aunque haya una correccion ensenada --
  // asi lo que Master ensena solo cambia las PALABRAS de la
  // respuesta, nunca congela la conversacion a medias esperando el
  // siguiente mensaje.
  const resultadoBase = await calcularRespuestaBase(mensaje, normalizado, estado, canalPublico, ubicaciones);

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
// Si ya habia una hora explicita pedida desde antes (horaPendiente,
// ver iniciarFlujoAgendado) y de verdad esta libre entre las opciones
// que se acaban de calcular para el dia, regresa esa hora ya con el
// formato bonito ("5:00 pm") -- si no, regresa null y se sigue el
// flujo normal de ofrecer la lista para escoger.
function intentarHoraPendiente(estado: EstadoAgendado, horarios: string[]): string | null {
  if (!estado.horaPendiente) return null;
  return buscarHoraExactaEnOpciones(estado.horaPendiente, horarios);
}

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
        turnoPendiente: undefined,
        horaPendiente: undefined,
        opcionesHorario: undefined,
        hora: undefined,
      };
      return { respuesta: "Mmm, ya no tengo horario libre para hoy. ¿Para qué otro día le gustaría agendar?", nuevoEstado };
    }
    const horaExacta = intentarHoraPendiente(estado, horarios);
    if (horaExacta) {
      const nuevoEstado: EstadoAgendado = {
        ...estado,
        paso: "nombre",
        dia: textoDia.trim(),
        fechaResuelta: fechaStr,
        turnoResuelto: turnoImplicito,
        turnoPendiente: undefined,
        horaPendiente: undefined,
        opcionesHorario: horarios,
        hora: horaExacta,
      };
      return { respuesta: "¿A qué nombre le agendo la cita?", nuevoEstado };
    }
    const nuevoEstado: EstadoAgendado = {
      ...estado,
      paso: "hora",
      dia: textoDia.trim(),
      fechaResuelta: fechaStr,
      turnoResuelto: turnoImplicito,
      turnoPendiente: undefined,
      horaPendiente: undefined,
      opcionesHorario: horarios,
      hora: undefined,
    };
    return { respuesta: `Tengo disponible hoy: ${muestrearHorarios(horarios).join(", ")}. ¿Cuál le queda mejor?`, nuevoEstado };
  }

  // Si el mismo mensaje del dia ya deja claro el turno tambien (ej. "el
  // sabado por la tarde"), o si ya lo habian dicho antes en otro
  // mensaje (turnoPendiente, ver iniciarFlujoAgendado), no hace falta
  // volver a preguntarlo -- se buscan de una vez los horarios para ese
  // turno.
  if (fechaStr) {
    const turnoFinal = interpretarTurno(normalizadoDia) ?? estado.turnoPendiente ?? null;
    if (turnoFinal) {
      const horarios = await obtenerHorariosDisponibles(fechaStr, estado.modalidad ?? "CONSULTORIO", turnoFinal);
      if (horarios.length === 0) {
        const nuevoEstado: EstadoAgendado = {
          ...estado,
          paso: "dia",
          dia: textoDia.trim(),
          fechaResuelta: undefined,
          turnoResuelto: undefined,
          turnoPendiente: undefined,
          horaPendiente: undefined,
          opcionesHorario: undefined,
          hora: undefined,
        };
        return {
          respuesta: "Mmm, no tengo horario libre ese día en ese horario. ¿Para qué otro día le gustaría agendar?",
          nuevoEstado,
        };
      }
      const horaExacta = intentarHoraPendiente(estado, horarios);
      if (horaExacta) {
        const nuevoEstado: EstadoAgendado = {
          ...estado,
          paso: "nombre",
          dia: textoDia.trim(),
          fechaResuelta: fechaStr,
          turnoResuelto: turnoFinal,
          turnoPendiente: undefined,
          horaPendiente: undefined,
          opcionesHorario: horarios,
          hora: horaExacta,
        };
        return { respuesta: "¿A qué nombre le agendo la cita?", nuevoEstado };
      }
      const nuevoEstado: EstadoAgendado = {
        ...estado,
        paso: "hora",
        dia: textoDia.trim(),
        fechaResuelta: fechaStr,
        turnoResuelto: turnoFinal,
        turnoPendiente: undefined,
        horaPendiente: undefined,
        opcionesHorario: horarios,
        hora: undefined,
      };
      return { respuesta: `Tengo disponible: ${muestrearHorarios(horarios).join(", ")}. ¿Cuál le queda mejor?`, nuevoEstado };
    }
  }

  const nuevoEstado: EstadoAgendado = {
    ...estado,
    paso: "turno",
    dia: textoDia.trim(),
    fechaResuelta: undefined,
    turnoResuelto: undefined,
    turnoPendiente: undefined,
    opcionesHorario: undefined,
    hora: undefined,
  };
  return { respuesta: "¿Le gustaría por la mañana o por la tarde?", nuevoEstado };
}

async function calcularRespuestaBase(
  mensaje: string,
  normalizado: string,
  estado: EstadoAgendado,
  canalPublico: boolean,
  ubicaciones: Ubicacion[]
): Promise<ResultadoRespuesta> {
  // 3) Si estamos a la mitad de agendar una cita, seguimos la pregunta
  // que sigue en ese flujo -- pero si a la mitad preguntan algo de
  // informacion general (tratamiento, precio, duracion), se contesta
  // esa duda sin perder el avance, y se repite la pregunta pendiente.
  if (estado.fase === "agendando" && estado.paso) {
    if (contieneAlguna(normalizado, TRATAMIENTO_KEYWORDS)) {
      return { respuesta: `${TRATAMIENTO_TEXT}\n\n${preguntaActualDelPaso(estado)}`, nuevoEstado: estado };
    }
    if (contieneAlguna(normalizado, UBICACION_KEYWORDS)) {
      return { respuesta: `${respuestaUbicacion(normalizado, ubicaciones)}\n\n${preguntaActualDelPaso(estado)}`, nuevoEstado: estado };
    }
    if (contieneAlguna(normalizado, DURACION_KEYWORDS) || contieneAlguna(normalizado, PRECIO_KEYWORDS)) {
      return { respuesta: `${PRECIO_DURACION_TEXT}\n\n${preguntaActualDelPaso(estado)}`, nuevoEstado: estado };
    }
    if (contieneAlguna(normalizado, PRONOSTICO_KEYWORDS)) {
      return { respuesta: `${PRONOSTICO_TEXT}\n\n${preguntaActualDelPaso(estado)}`, nuevoEstado: estado };
    }
    const temaEscaneo = detectarTemaEscaneo(normalizado);
    if (temaEscaneo) {
      return {
        respuesta: `Claro que sí, el escaneo también revisa eso (${temaEscaneo}). No se preocupe, ahí lo vemos bien.\n\n${preguntaActualDelPaso(estado)}`,
        nuevoEstado: estado,
      };
    }
    switch (estado.paso) {
      case "modalidad": {
        const detectado = detectarModalidadYLugar(normalizado);
        if (!detectado) {
          // Si lo que dijo es un dolor o molestia (ej. "me duele la
          // pierna mucho"), no se le repite la pregunta en seco como si
          // no hubiera dicho nada -- se reconoce lo que dijo primero,
          // igual que se hace fuera de este flujo (regla 9 de abajo).
          if (contieneAlguna(normalizado, SINTOMA_KEYWORDS)) {
            const parte = detectarParteCuerpo(normalizado);
            return {
              respuesta: `${respuestaSintoma(parte)} ¿Sería en consultorio o a domicilio?`,
              nuevoEstado: estado,
            };
          }
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

        const { modalidad, lugar } = detectado;
        // Si ya dejaron claro el lugar junto con la modalidad (ej.
        // "consultorio san blas", o mencionan directo un municipio de
        // domicilio), no hace falta volver a preguntar cual es -- se
        // salta directo a personas.
        if (lugar) {
          const nuevoEstado: EstadoAgendado = { ...estado, paso: "personas", modalidad, lugar };
          return { respuesta: "¿Cuántas personas serían?", nuevoEstado };
        }

        const nuevoEstado: EstadoAgendado = { ...estado, paso: "lugar", modalidad };
        return { respuesta: siguientePreguntaLugar(modalidad), nuevoEstado };
      }
      case "lugar": {
        if (estado.modalidad === "DOMICILIO" && !municipioDomicilioValido(mensaje)) {
          if (municipioCercanoNoCubierto(mensaje)) {
            // Si mencionaron un municipio real y cercano que de plano
            // no se cubre (ej. Guadalupe), se le avisa -- ahi si ya
            // contesto algo, nada mas que no se puede.
            return {
              respuesta:
                "Uy, a ese municipio todavía no llegamos a domicilio. Por ahora solo cubrimos García, Santa Catarina, San Pedro, Escobedo, Carmen, Monterrey, San Nicolás y Apodaca. ¿En cuál de esos sería, o prefiere mejor en consultorio?",
              nuevoEstado: estado,
            };
          }
          // No se reconocio ningun nombre de municipio (ni de los que
          // se cubren ni de los cercanos que no se cubren) -- lo mas
          // probable es que haya dicho una colonia, calle o referencia
          // (ej. "valle de Lincoln sector Mitras"), no el municipio en
          // si. No se le dice que ese municipio no se cubre (porque
          // todavia no dijo ninguno) -- se le vuelve a pedir derecho.
          return { respuesta: "¿Me puede decir en qué municipio vive, por favor?", nuevoEstado: estado };
        }
        const nuevoEstado: EstadoAgendado = { ...estado, paso: "personas", lugar: mensaje.trim() };
        return { respuesta: "¿Cuántas personas serían?", nuevoEstado };
      }
      case "personas": {
        const estadoConPersonas: EstadoAgendado = { ...estado, personas: String(contarPersonas(mensaje)) };
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
          const nuevoEstado: EstadoAgendado = { ...estado, paso: "dia", horaPendiente: undefined };
          return {
            respuesta: "Mmm, no tengo horario libre ese día. ¿Para qué otro día le gustaría agendar?",
            nuevoEstado,
          };
        }
        const horaExacta = intentarHoraPendiente(estado, horarios);
        if (horaExacta) {
          const nuevoEstado: EstadoAgendado = {
            ...estado,
            paso: "nombre",
            fechaResuelta: fechaStr,
            turnoResuelto: turno,
            horaPendiente: undefined,
            opcionesHorario: horarios,
            hora: horaExacta,
          };
          return { respuesta: "¿A qué nombre le agendo la cita?", nuevoEstado };
        }
        const nuevoEstado: EstadoAgendado = {
          ...estado,
          paso: "hora",
          fechaResuelta: fechaStr,
          turnoResuelto: turno,
          horaPendiente: undefined,
          opcionesHorario: horarios,
        };
        return { respuesta: `Tengo disponible: ${muestrearHorarios(horarios).join(", ")}. ¿Cuál le queda mejor?`, nuevoEstado };
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

        let horaBonita = buscarEnOpcionesOfrecidas(mensaje, estado.opcionesHorario);

        // Si pidio una hora que no estaba entre las que le ofrecimos (ej.
        // le ofrecimos la tarde y pide otra hora de plano, o pide una
        // hora que ya no tiene espacio), antes de aceptarla a ciegas se
        // revisa contra TODO lo disponible ese dia (sin limitar al turno
        // que se pregunto al inicio). Aqui ya no se vale adivinar el
        // am/pm por el turno -- se exige que la hora sea inequivoca,
        // porque si no, se podria confundir "6pm" con un "6am" libre.
        if (!horaBonita && tieneDigito && estado.fechaResuelta && estado.modalidad) {
          const todasLasOpciones = await obtenerHorariosDisponibles(estado.fechaResuelta, estado.modalidad, null);
          horaBonita = buscarHoraExactaEnOpciones(mensaje, todasLasOpciones);
        }

        if (!horaBonita && tieneDigito && estado.fechaResuelta && estado.modalidad) {
          // Ya se reviso y esa hora de plano no tiene espacio ese dia --
          // no se agenda a ciegas. Si se pudo leer bien la hora exacta
          // que pidieron, se checan tambien los proximos 2 dias por si
          // ahi si hay espacio a esa misma hora.
          let avisoOtroDia = "";
          const horaExplicita = extraerHoraExplicita(mensaje);
          if (horaExplicita) {
            for (let i = 1; i <= 2; i++) {
              const fechaSiguiente = sumarDias(estado.fechaResuelta, i);
              const opcionesSiguiente = await obtenerHorariosDisponibles(fechaSiguiente, estado.modalidad, null);
              const encontradaOtroDia = buscarHoraExactaEnOpciones(mensaje, opcionesSiguiente);
              if (encontradaOtroDia) {
                // Se le pide que conteste con el numero del dia del mes
                // (no el nombre del dia de la semana) porque asi la
                // regla de arriba que detecta cambio de dia lo entiende
                // sin ambiguedad -- un nombre de dia como "el viernes"
                // se resuelve a partir de HOY y podria no ser el mismo
                // viernes que se le esta sugiriendo aqui.
                const numeroDia = parseInt(fechaSiguiente.split("-")[2], 10);
                avisoOtroDia = ` Eso sí, el ${formatFechaBonita(fechaSiguiente)} sí tengo espacio a las ${encontradaOtroDia} -- si gusta cambiar su cita a ese día, nada más dígame "el ${numeroDia}".`;
                break;
              }
            }
          }
          return {
            respuesta: estado.opcionesHorario?.length
              ? `Mmm, a esa hora ya no tengo espacio ese día.${avisoOtroDia} Si no, ¿cuál de estas horas le queda mejor: ${muestrearHorarios(estado.opcionesHorario).join(", ")}?`
              : `Mmm, a esa hora ya no tengo espacio ese día.${avisoOtroDia} Si no, ¿a qué otra hora le gustaría agendar?`,
            nuevoEstado: estado,
          };
        }

        const horaFinal = horaBonita ?? formatearHora(mensaje, estado.turnoResuelto ?? null);
        const nuevoEstado: EstadoAgendado = { ...estado, paso: "nombre", hora: horaFinal };
        return { respuesta: "¿A qué nombre le agendo la cita?", nuevoEstado };
      }
      case "nombre": {
        const nuevoEstado: EstadoAgendado = { ...estado, paso: "celular", nombre: mensaje.trim() };
        return { respuesta: "¿A qué número de WhatsApp le mandamos el recordatorio de su cita?", nuevoEstado };
      }
      case "celular": {
        const resumen = construirResumenAgendado(estado, estado.nombre ?? "", mensaje.trim());
        return {
          respuesta: `${resumen.texto}\n\n${REQUISITOS_TEXT}`,
          nuevoEstado: { fase: "conversando" },
          agendado: resumen.datos,
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

  // Preguntan por la ubicacion/direccion de alguno de los consultorios
  // (ej. "mandame la ubicacion de San Blas y de Mitras") -- se manda
  // la direccion de texto mas el link de Google Maps de cada uno que
  // pidieron.
  if (contieneAlguna(normalizado, UBICACION_KEYWORDS)) {
    return { respuesta: respuestaUbicacion(normalizado, ubicaciones), nuevoEstado: { ...estado, fase: "conversando" } };
  }

  // 7) Preguntas de precio / duracion (ya contestadas por el texto de bienvenida,
  // pero se repiten seguido).
  if (contieneAlguna(normalizado, DURACION_KEYWORDS) || contieneAlguna(normalizado, PRECIO_KEYWORDS)) {
    return { respuesta: PRECIO_DURACION_TEXT, nuevoEstado: { ...estado, fase: "conversando" } };
  }

  // Preguntas sobre el tratamiento (que dan, que costo tiene, si
  // recetan, etc.) -- muy comun que pregunten esto antes de agendar.
  if (contieneAlguna(normalizado, TRATAMIENTO_KEYWORDS)) {
    return { respuesta: TRATAMIENTO_TEXT, nuevoEstado: { ...estado, fase: "conversando" } };
  }

  // Preguntan si se les va a quitar, si tiene solucion, si sabran que
  // es, etc. -- no nos adelantamos, pero se invita a agendar de una vez.
  if (contieneAlguna(normalizado, PRONOSTICO_KEYWORDS)) {
    return {
      respuesta: `${PRONOSTICO_TEXT} ¿Para cuándo le gustaría agendar su cita?`,
      nuevoEstado: { fase: "agendando", paso: "modalidad" },
    };
  }

  // Preguntan por algo especifico que si revisa el escaneo (ej.
  // "pueden revisar la prostata?") -- se confirma que si, mencionando
  // lo que preguntaron, en vez de la respuesta generica.
  {
    const temaEscaneo = detectarTemaEscaneo(normalizado);
    if (temaEscaneo) {
      return {
        respuesta: `Claro que sí, el escaneo también revisa eso (${temaEscaneo}). No se preocupe, ahí lo vemos bien. ¿Para cuándo le gustaría agendar su cita?`,
        nuevoEstado: { fase: "agendando", paso: "modalidad" },
      };
    }
  }

  // 8) Cualquier intencion de agendar arranca el flujo de la cita.
  if (pareceIntencionAgendar(mensaje, normalizado)) {
    return iniciarFlujoAgendado(normalizado, mensaje);
  }

  // 9) Menciona un dolor o molestia: respuesta tranquila + cierre directo.
  if (contieneAlguna(normalizado, SINTOMA_KEYWORDS)) {
    const parte = detectarParteCuerpo(normalizado);
    return {
      respuesta: `${respuestaSintoma(parte)} ¿Para cuándo le gustaría agendar su cita?`,
      nuevoEstado: { fase: "agendando", paso: "modalidad" },
    };
  }

  // 10) Despedidas/bendiciones (ej. "dios le bendiga", despues de que
  // ya se agendo la cita) -- se contesta con calidez en vez de decir
  // que no se entendio, ya que la conversacion ya se cerro bien.
  if (contieneAlguna(normalizado, BENDICION_KEYWORDS)) {
    return {
      respuesta: "Amén, muchas gracias 🙏 Que tenga un excelente día.",
      nuevoEstado: { ...estado, fase: "conversando" },
    };
  }

  // 11) Un simple "ok", "gracias", "vale", etc. (sin pregunta ni dato
  // nuevo) -- en vez de decir que no entendio, se invita a agendar.
  if (contieneAlguna(normalizado, ACK_KEYWORDS) && normalizado.split(" ").length <= 3) {
    return {
      respuesta: "¿Para cuándo le gustaría agendar su cita?",
      nuevoEstado: { fase: "agendando", paso: "modalidad" },
    };
  }

  // 12) No se reconocio nada. En el chat de entrenamiento se marca para
  // que Master lo entrene -- pero a un paciente real NUNCA se le debe
  // decir que el bot no sabe que contestar, asi que ahi se le contesta
  // con algo amable que lo encamine a agendar o a preguntar su duda.
  if (canalPublico) {
    return {
      respuesta: "¡Con gusto le ayudo! 😊 ¿Le gustaría agendar su cita, o tiene alguna otra duda sobre nuestros servicios (precio, duración, tratamientos)?",
      nuevoEstado: { ...estado, fase: "conversando" },
    };
  }
  return {
    respuesta: "Mmm, no estoy seguro de cómo contestar eso todavía. Usa el botón de \"Enseñar respuesta\" de abajo para decirme qué debí haber dicho.",
    nuevoEstado: { ...estado, fase: "conversando" },
    nota: "sin_entrenar",
  };
}

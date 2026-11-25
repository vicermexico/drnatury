import "server-only";
import {
  normalizar,
  detectarCodigoAnuncio,
  coincideConAnuncio,
  CELULAR_TEMPRANO_TEXT,
  type Anuncio,
  type Correccion,
  type BienvenidaItem,
  type ResumenPedido,
} from "./engine";

// "Cerebro" del bot de venta de la Pomada Barak Flex (Fase 2 del bot de
// venta de productos, ver bots.ts) -- totalmente separado del cerebro
// de citas (engine.ts): aqui no se agenda ninguna consulta, se vende un
// producto y se agenda su ENTREGA a domicilio con pago contra entrega.
//
// A proposito es su propio archivo en vez de meter mas "ifs" al engine
// de citas: son dos conversaciones con muy poco en comun (el de citas
// ya tiene cientos de lineas sobre sintomas, consultorios, horarios de
// terapeutas, etc. que no aplican aqui), asi que es mas facil de leer y
// de corregir si cada quien vive en su propio archivo.

export interface EstadoPedido {
  fase: "inicio" | "conversando" | "pidiendo";
  paso?:
    | "cantidad"
    | "nombre"
    | "celular"
    | "direccion"
    | "dia_manana"
    | "dia_cual"
    | "horario_bloque"
    | "horario_confirmar"
    | "horario_mitad";
  cantidad?: number;
  nombre?: string;
  celular?: string;
  direccion?: string;
  // El DIA de entrega (ISO yyyy-mm-dd) -- Vic pidio que primero se
  // pregunte el dia (ofreciendo mañana mismo de entrada) y YA HASTA
  // ENTONCES se pregunte mañana/tarde para ESE dia -- antes se
  // preguntaba mañana/tarde sin saber todavia que dia era, lo cual no
  // tiene sentido (el horario de entrega depende del dia).
  fecha?: string;
  // En que mitad del dia quiere la entrega -- se pregunta primero esto
  // (manana u tarde) y luego, si se queja de que el rango de 6 horas es
  // mucho tiempo, se le ofrece partirlo a la mitad (ver paso "horario_mitad").
  bloque?: "manana" | "tarde";
  // Igual que en el bot de citas (ver CELULAR_TEMPRANO_TEXT en engine.ts):
  // se le pide el numero de WhatsApp desde el primer mensaje que
  // escribio de verdad, por si se sale a medio chat sin terminar su
  // pedido -- asi de todos modos se le puede volver a contactar. No se
  // confunde con "celular" (el que se usa para confirmar el pedido, en
  // el paso "celular" de mas arriba) -- si ya se tiene este, no se
  // vuelve a pedir ahi.
  celularPedidoTemprano?: boolean;
  // Cuantas veces se le ha insistido con el celular sin que lo de --
  // solo se insiste una vez mas, para no ser pesados.
  celularTempranoIntentos?: number;
}

export const ESTADO_INICIAL_PEDIDO: EstadoPedido = { fase: "inicio" };

export interface ResultadoRespuestaPomada {
  respuesta: string;
  nuevoEstado: EstadoPedido;
  nota?: string;
  mensajesBienvenida?: BienvenidaItem[];
  pedido?: ResumenPedido;
  // true cuando el cliente pidio ver el catalogo (ver CATALOGO_KEYWORDS
  // mas abajo) -- la ruta publica (route.ts) rellena la lista real de
  // productos antes de mandarsela al chat; aqui nada mas se marca la
  // intencion. Por ahora el catalogo es solo para ver y compartir -- el
  // pedido de verdad sigue siendo solo de la Pomada (Vic pidio dejar
  // pendiente "pedir cualquier producto" hasta que suba mas productos).
  mostrarCatalogo?: boolean;
  // true cuando el bot le acaba de pedir su direccion mencionando que
  // tambien puede darle clic al pin de ubicacion -- el chat publico
  // (PublicChatDemo.tsx) usa esto para pintar una flechita señalando
  // ese botón un rato, y que no se le pase por alto (Vic lo pidio
  // explicitamente despues de ver que la gente seguia escribiendo su
  // direccion a mano en vez de usar el pin).
  pedirUbicacion?: boolean;
}

// Precio fijo por pomada (dato que dio Vic) -- se puede pedir mas de
// una, y el envio siempre es gratis.
const PRECIO_UNITARIO = 590;

function contieneAlguna(normalizado: string, frases: string[]): boolean {
  return frases.some((f) => normalizado.includes(f));
}

// Cada grupo es una forma de mencionar una parte del cuerpo o molestia
// (lista que dio Vic para la campaña de Facebook) -- "claves" ya debe
// venir sin acentos (normalizar() los quita), "texto" es como se
// menciona de vuelta en la respuesta, con acentos, para que se lea bien.
const PARTES_CUERPO: { claves: string[]; texto: string }[] = [
  // Estas dos van ANTES que "talon" (el orden importa -- gana el
  // primer grupo que haga match): Vic reporto un caso real de alguien
  // que escribio "fascitis plantar... en el talon izquierdo" y el bot
  // contesto solo "el talón de Aquiles", sin reconocer la fascitis que
  // SI mencionaron -- asi, si aparecen las dos palabras, gana la mas
  // especifica. "flacitis" queda a proposito (typo comun de voz a
  // texto por "fascitis").
  { claves: ["fascitis plantar", "fascitis", "flacitis plantar", "flacitis"], texto: "la fascitis plantar" },
  { claves: ["espolon calcaneo", "espolon"], texto: "el espolón calcáneo" },
  { claves: ["ciatica"], texto: "la ciática" },
  { claves: ["lumbar"], texto: "la zona lumbar" },
  { claves: ["espalda"], texto: "la espalda" },
  { claves: ["columna"], texto: "la columna" },
  { claves: ["hombro"], texto: "los hombros" },
  { claves: ["cervical"], texto: "las cervicales" },
  { claves: ["cuello"], texto: "el cuello" },
  { claves: ["mano"], texto: "las manos" },
  { claves: ["pierna", "piernas"], texto: "las piernas" },
  { claves: ["rodilla"], texto: "las rodillas" },
  { claves: ["talon de aquiles", "talon"], texto: "el talón de Aquiles" },
  { claves: ["planta de"], texto: "la planta del pie" },
  { claves: ["metatarso"], texto: "el metatarso" },
  { claves: ["arco del pie"], texto: "el arco del pie" },
  { claves: ["tobillo"], texto: "el tobillo" },
  { claves: ["cadera"], texto: "la cadera" },
  { claves: ["chamorro"], texto: "el chamorro" },
  { claves: ["calambre"], texto: "los calambres" },
  { claves: ["varice", "varises"], texto: "las várices" },
  { claves: ["contractura"], texto: "las contracturas" },
  { claves: ["ligamento"], texto: "los ligamentos" },
  { claves: ["articulacion"], texto: "las articulaciones" },
];

const DOLOR_KEYWORDS = [
  ...PARTES_CUERPO.flatMap((g) => g.claves),
  "dolor",
  "duele",
  "duelen",
  "molestia",
  "me lastime",
  "me lastimé",
  "me lesione",
  // Formas de COMENTAR el dolor (no solo preguntar) -- sinonimos y
  // quejas parecidas, para que se detecten igual de bien.
  "no aguanto",
  "ya no aguanto",
  "no soporto",
  "ya no soporto",
  "no puedo con el dolor",
  "me esta matando",
  "me mata",
  "no me deja",
  "no la paso",
  "sufro de",
  "padezco",
  "ando mal de",
  "me tiene mal",
  "dolor tremendo",
  "dolor horrible",
  "dolor fuerte",
  "mucho dolor",
  "demasiado dolor",
  "me duele un buen",
  "me duele bastante",
  "no puedo ni caminar",
  "no puedo caminar bien",
  "no puedo moverme",
  // Sintomas generales (no necesariamente dolor) que Vic pidio
  // reconocer tambien -- debilidad, cansancio, hormigueo, etc. ("entumec"
  // y "hormig" quedan como raiz a proposito, para cubrir conjugaciones
  // como "entumecido"/"entumecida" y "hormiguean"/"hormigueando".)
  "debilidad",
  "me siento debil",
  "sin fuerza en las piernas",
  "cansancio en las piernas",
  "cansancio muscular",
  "piernas cansadas",
  "piernas dormidas",
  "se me duermen las piernas",
  "se me adormecen",
  "entumec",
  "hormig",
  "rigidez",
  "inflamacion",
  "inflamado",
  "inflamada",
  "hinchazon",
  "hinchado",
  "hinchada",
];

function detectarParteMencionada(normalizado: string): string | null {
  for (const grupo of PARTES_CUERPO) {
    if (grupo.claves.some((c) => normalizado.includes(c))) return grupo.texto;
  }
  return null;
}

// "si" es muy corto y aparece COMO SUBSTRING dentro de muchas palabras
// que no tienen nada que ver (ej. "necesidad", "asistir", "decision"),
// asi que para las afirmaciones cortas (ver SI_KEYWORDS) no basta con
// buscar la frase en cualquier parte del mensaje -- hay que exigir que
// aparezca como palabra completa (con espacio o inicio/fin de mensaje
// a los lados). El resto de las listas de este archivo son frases de
// varias palabras (mucho menos riesgo de que aparezcan "disfrazadas"
// adentro de otra palabra), asi que esas se quedan con el chequeo de
// siempre.
function contieneFraseCompleta(normalizado: string, frases: string[]): boolean {
  return frases.some((f) => new RegExp(`(^|\\s)${f}(\\s|$)`).test(normalizado));
}

// La gente muchas veces alarga el "si" para enfatizar ("siii", "siiii",
// "siiiii"...), y contieneFraseCompleta con la frase literal "si" no
// detecta eso (porque exige la palabra exacta "si"). Esta funcion es un
// envoltorio de contieneFraseCompleta(normalizado, SI_KEYWORDS) que
// ademas reconoce cualquier variante alargada de "si"/"sii"/"siii" como
// palabra completa.
function esAfirmacion(normalizado: string, frases: string[]): boolean {
  if (/(^|\s)si+(\s|$)/.test(normalizado)) return true;
  return contieneFraseCompleta(normalizado, frases);
}

// Descripcion breve de cada ingrediente, para cuando preguntan "que
// contiene", "para que sirve", etc. -- informacion general de para que
// se usan normalmente estos ingredientes en pomadas para el dolor
// muscular/articular (no es un diagnostico medico).
const INGREDIENTES_TEXT =
  "La Pomada Barak Flex contiene:\n\n" +
  "• Glucosamina y Condroitina -- ayudan a cuidar las articulaciones y el cartílago.\n" +
  "• Citrato de Magnesio -- ayuda a relajar los músculos y aliviar calambres.\n" +
  "• Clavo y Ajo Negro -- con propiedades naturales antiinflamatorias.\n" +
  "• Alcanfor y Mentol -- dan un efecto frío-calor que alivia al instante el dolor muscular y articular.";

const INGREDIENTE_KEYWORDS = [
  "que contiene",
  "que trae",
  "ingredientes",
  "de que esta hecha",
  "de que esta hecho",
  "de que esta compuesta",
  "composicion",
  "componentes",
  "que lleva",
  "que tiene la pomada",
  "para que es buena",
  "para que sirve",
  "que es lo que tiene",
  "con que esta hecha",
  "con que la hacen",
  // "Saber mas"/"mas informacion" -- cuando contestan eso a la
  // pregunta de "¿le gustaria saber mas, o que le hagamos su pedido?"
  // (ver respuestaDolor y las demas respuestas que terminan igual), se
  // le manda esta misma informacion de los ingredientes. Nota: aqui no
  // hace falta la version con acentos -- normalizar() ya les quita los
  // acentos antes de comparar.
  "saber mas",
  "mas informacion",
  "mas info",
  "cuentame mas",
  "dime mas",
  "explicame mas",
  "mas detalles",
  // Pidiendo "informacion"/"info" a secas, sin decir de que exactamente
  // (ej. "quisiera info", "me das informacion porfa", "información del
  // producto") -- "info" ya cubre "información" tambien, por ser
  // substring de la palabra completa.
  "info",
];

const PRECIO_KEYWORDS = [
  "cuanto cuesta",
  "precio",
  "cuanto vale",
  "cuanto sale",
  "costo",
  "cuanto esta",
  "que precio tiene",
  "en cuanto sale",
  "en cuanto me sale",
  "cuanto me sale",
  "en cuanto la dan",
  "cuanto me cuesta",
  "cual es el costo",
  "que precio manejan",
  "cuanto es",
];

function respuestaPrecio(): string {
  return (
    `La Pomada Barak Flex cuesta $${PRECIO_UNITARIO} MXN cada una, puede pedir las que quiera, ` +
    `y el envío es totalmente gratis 🚚 El pago es contra entrega (paga hasta que la reciba, sin anticipo). ` +
    `¿Le gustaría que le hagamos su pedido?`
  );
}

// Pregunta especifica sobre el COSTO DEL ENVIO (no del precio general de
// la pomada) -- Vic pidio que si solo preguntan por el envio, se
// conteste nada mas eso (ya se menciona de nuevo en respuestaPrecio si
// despues preguntan el precio completo). Se exige la palabra "envio" +
// alguna palabra de costo/queja para no confundirse con otras frases
// que solo mencionen el envio de pasada (ej. "¿y el envío cuánto tarda?"
// tambien cae aqui, que es lo correcto).
const ENVIO_PALABRAS_COSTO = ["cuesta", "costo", "cobran", "cobrar", "gratis", "caro", "aparte", "tiene"];

function parecePreguntaEnvio(normalizado: string): boolean {
  if (!normalizado.includes("envio")) return false;
  return ENVIO_PALABRAS_COSTO.some((p) => normalizado.includes(p));
}

function respuestaEnvio(): string {
  return "El envío es totalmente gratis 🚚 no se le cobra nada extra por mandársela. ¿Le gustaría que le hagamos su pedido?";
}

// Preguntan DONDE se entrega/recoge/compra (no el precio ni el
// horario) -- Vic pidio dejar claro que es a domicilio, sin costo, y
// que se paga hasta recibirla (por su seguridad).
const ENTREGA_KEYWORDS = [
  "en donde entregan",
  "donde entregan",
  "en donde entregas",
  "donde entregas",
  "como la recojo",
  "como recojo",
  "donde la recojo",
  "donde recojo",
  "donde la compro",
  "en donde la compro",
  "donde las venden",
  "donde la venden",
  "donde consigo",
  "donde puedo comprar",
  "tienen local",
  "tienen tienda",
  "tienda fisica",
  "puedo pasar por ella",
  "puedo ir por ella",
  "la puedo recoger",
];

function respuestaEntrega(): string {
  return (
    "Barak Flex se entrega directo en su domicilio para su comodidad, ya que el envío es totalmente gratis 🚚 " +
    "y el pago es contra entrega (paga hasta que la reciba, sin anticipo), para su seguridad. " +
    "¿Le gustaría que le hagamos su pedido?"
  );
}

// Preguntan los HORARIOS de entrega (no si ya quieren agendar la
// entrega, eso ya se pregunta aparte dentro del pedido, ver paso
// "horario_bloque") -- nada mas informar que se entrega en la mañana o
// en la tarde.
const HORARIO_ENTREGA_KEYWORDS = [
  "horarios de entrega",
  "horario de entrega",
  "que horarios tienen",
  "que horarios manejan",
  "que horas entregan",
  "a que hora entregan",
  "a que horas entregan",
  "a que horas vienen",
  "a que hora vienen",
  "a que hora llega",
  "en que horario llega",
  "cuando llega",
  "en que horario entregan",
  "que dias entregan",
];

function respuestaHorarioEntrega(): string {
  return (
    "Las entregas son en la mañana (8:00am a 2:00pm) o en la tarde (2:00pm a 8:00pm), usted elige la que le quede mejor 🙂 " +
    "¿Le gustaría que le hagamos su pedido?"
  );
}

// Piden ver una foto/imagen de la pomada -- se le manda el catálogo
// (que ya trae la foto, nombre y precio del producto), en vez de
// inventar un mensaje nuevo solo de imagen.
const FOTO_KEYWORDS = ["foto", "fotografia", "imagen"];

// Respuesta para CUALQUIER dolor/molestia que mencionen (no solo
// ciática -- aplica igual para espalda, rodillas, cervicales, etc., ver
// PARTES_CUERPO): nada mas el beneficio y los ingredientes. El precio,
// el envío gratis y el pago contra entrega se dejan para cuando
// pregunten el precio (ver respuestaPrecio) o ya quieran pedirla (ver
// iniciarPedido) -- no se le avienta todo junto de entrada.
//
// A proposito NO empieza con "¡Claro que sí!" -- esa muletilla solo
// tiene sentido si de verdad preguntaron algo (ej. "¿me ayuda con mi
// ciática?"), pero muchas veces nada mas COMENTAN su dolor sin
// preguntar nada (ej. "no aguanto el dolor de la ciática"), y ahi
// sonaba raro contestarles "claro que sí" sin que hubiera pregunta.
function respuestaDolor(normalizado: string): string {
  const parte = detectarParteMencionada(normalizado);
  return (
    `La Pomada Barak Flex le puede ayudar muchísimo${parte ? ` con ese dolor en ${parte}` : " con ese dolor"} 💪 ` +
    `gracias a sus activos únicos de alta tecnología. ` +
    `¿Le gustaría hacer su pedido?`
  );
}

// Cuando YA preguntaron/comentaron un dolor especifico y luego
// confirman con algo generico tipo "¿y sirve para todos esos dolores
// que dice?" -- a diferencia de respuestaDolor, aqui SI tiene sentido
// empezar con "¡Claro!" porque de verdad preguntaron algo.
const CONFIRMA_DOLOR_GENERAL_KEYWORDS = [
  "todos esos dolores",
  "todos los dolores",
  "cualquier dolor",
  "cualquier malestar",
  "todos los males",
  "para todos los males",
  "buena para lo que dicen",
  "buena para lo que dice",
  "es buena para eso",
  "sirve para eso",
  "sirve para cualquier dolor",
  "ayuda para todos los males",
  "es buena para lo que dicen",
  "es buena para lo que dice",
];

function respuestaDolorGeneral(): string {
  return (
    "¡Claro! Ayuda para todos los dolores mencionados 💪, gracias a sus activos únicos de alta tecnología. " +
    "¿Le gustaría hacer su pedido?"
  );
}

// Frases fuertes de intencion de compra (ya saben que la quieren, sin
// que se les tenga que preguntar "¿le gustaria pedirla?" antes).
const COMPRAR_KEYWORDS = [
  "quiero comprar",
  "quiero pedir",
  "quiero ordenar",
  "quiero adquirir",
  "quiero una pomada",
  "quiero mi pomada",
  "quiero la pomada",
  "si la quiero",
  "la quiero",
  "me interesa comprarla",
  "me interesa pedirla",
  "me interesa comprar",
  "deseo comprarla",
  "deseo pedirla",
  "me gustaria pedirla",
  "me gustaria comprarla",
  "hagame el pedido",
  "hazme el pedido",
  "quiero que me la manden",
  "quiero que me la envien",
  "mandenmela",
  "envienmela",
  "dame una",
  "mandenme",
  "mándenme",
  "quiero mandarla pedir",
];

// Palabras de intencion de compra cuando se mencionan junto con la
// palabra "pomada" o "producto" (ej. "quiero pomada", "me gustaria una
// pomada", "me gustaria 1 pomada", "quiero el producto", "me interesa
// el producto") -- en vez de listar cada combinacion posible de
// articulo/cantidad, se checa que aparezca "pomada" o "producto" Y
// ademas alguna de estas (mismo patron que pareceCatalogo).
const INTENCION_COMPRA_PALABRAS = ["quiero", "quisiera", "deseo", "me gustaria", "dame", "mandenme", "envienme"];

function pareceQuererComprar(normalizado: string): boolean {
  if (contieneAlguna(normalizado, COMPRAR_KEYWORDS)) return true;
  // Si en el mismo mensaje tambien preguntan algo informativo (ej.
  // "quiero saber mas de la pomada", "quiero saber que contiene"), NO
  // cuenta como intencion de compra -- que conteste eso primero.
  if (contieneAlguna(normalizado, INGREDIENTE_KEYWORDS)) return false;
  if (!normalizado.includes("pomada") && !normalizado.includes("producto")) return false;
  return INTENCION_COMPRA_PALABRAS.some((p) => normalizado.includes(p));
}

// Afirmaciones cortas (ej. contestando "¿le gustaria pedirla?" o "¿le
// parece bien ese horario?") -- igual que la regla del bot de citas,
// solo cuentan si el mensaje es cortito (no es que la palabra "si"
// aparezca en medio de una frase larga sobre otra cosa).
const SI_KEYWORDS = [
  "si",
  "sip",
  "va",
  "dale",
  "simon",
  "claro",
  "obvio",
  "obviamente",
  "asi es",
  "efectivamente",
  "correcto",
  "aja",
  "sale",
  "porfavor",
  "por favor",
  "adelante",
  "esta bien",
  "de acuerdo",
  "perfecto",
  "ok",
  "okay",
  "vale",
  "andale",
  "me late",
];

const NO_KEYWORDS = [
  "no quiero",
  "no gracias",
  "no por ahora",
  "no por el momento",
  "no me interesa",
  "no de momento",
  "no todavia",
  "aun no",
  "despues la pido",
  "lo voy a pensar",
  "lo pensare",
  "quizas despues",
  "al rato la pido",
];

// Cuando contestan que la quieren "por necesidad" (en vez de
// prevencion, ver la pregunta de bienvenida que Vic armo en Master)
// sin decir todavia cual es el problema -- se le pregunta cual es,
// para poder contestar con el sintoma/parte del cuerpo correcto en
// cuanto lo diga (ver DOLOR_KEYWORDS mas abajo).
const NECESIDAD_SIN_DETALLE_KEYWORDS = [
  "por necesidad",
  "es por necesidad",
  "si es necesidad",
  "es necesidad",
  "la necesito",
  "si la necesito",
  "porque la necesito",
  "la ocupo",
  "si la ocupo",
  "porque la ocupo",
  "tengo un problema",
  "tengo una molestia",
  "por un problema",
  "por una molestia",
];

function respuestaNecesidadSinDetalle(): string {
  return "¡Claro! ¿Y qué problema es el que padece? Así le puedo decir mejor cómo le puede ayudar 😊";
}

// Cuando ya se le pidio el celular (ver CELULAR_TEMPRANO_TEXT) y
// contesta diciendo que si lo va a dar, pero el mensaje todavia no
// trae los digitos de verdad (ej. "si te paso mi celular") -- antes
// cafa en la respuesta generica de "no se que contestar"; ahora se le
// pide directo que mande los 10 digitos.
const CELULAR_PROMETIDO_KEYWORDS = [
  "te paso mi celular",
  "te doy mi celular",
  "te mando mi celular",
  "ahi te va mi celular",
  "te paso mi numero",
  "te doy mi numero",
  "te mando mi numero",
  "ahi te va mi numero",
  "te lo paso",
  "te lo doy",
  "te lo mando",
  "se lo paso",
  "se lo doy",
  "se lo mando",
];

// Frases para cuando se queja de que el rango de 6 horas es mucho
// tiempo (sinonimos que dio Vic) -- ahi se le ofrece partir el rango a
// la mitad (ver paso "horario_mitad").
const QUEJA_TIEMPO_KEYWORDS = [
  "mucho tiempo",
  "muchas horas",
  "mucho lapso",
  "no puedo esperar",
  "no tengo tanto tiempo",
  "es mucho",
  "muy tardado",
  "bastante tiempo",
  "tanto tiempo",
  "tanto rato",
  "mucho rato",
  "muy largo",
  "muy amplio",
  "mas corto",
  "más corto",
  "menos tiempo",
  "mas especifico",
  "algo mas rapido",
  "mas pronto",
  "lo quiero mas rapido",
];

// Frases para cuando quieren ver el catalogo de productos (no nomas
// preguntar el precio de la pomada) -- se manda el link/tarjeta de la
// revista. Va ANTES que todo lo demas (ver generarRespuestaPomada) para
// que no se confunda con una pregunta sobre la pomada, pero nunca
// interrumpe un pedido ya empezado (fase "pidiendo").
// Frases que de por si ya dicen "catalogo", sin necesidad de que
// aparezca la palabra "producto" (ej. "ver la revista", "catalogo").
const CATALOGO_KEYWORDS = [
  "catalogo",
  "catálogo",
  "ver la revista",
  "revista",
];

// Para el resto de las formas de preguntar ("que productos tienes",
// "que productos manejan", "que otros productos hay", etc.) en vez de
// listar frase por frase (facil que falte una variante, como paso con
// "tienes" vs "tienen"), se checa que el mensaje mencione "producto(s)"
// Y ademas tenga alguna palabra de pregunta/cantidad -- cubre tu/usted,
// singular/plural y mucho mas variantes con menos codigo.
const CATALOGO_PALABRAS_INTENCION = [
  "que",
  "cual",
  "cuales",
  "tiene",
  "tienes",
  "tienen",
  "manejan",
  "manejas",
  "maneja",
  "venden",
  "vendes",
  "vende",
  "hay",
  "mas",
  "más",
  "otro",
  "otros",
  "otra",
  "otras",
  "ver",
  "mostrar",
];

function pareceCatalogo(normalizado: string): boolean {
  if (contieneAlguna(normalizado, CATALOGO_KEYWORDS)) return true;
  if (contieneAlguna(normalizado, FOTO_KEYWORDS)) return true;
  // "Mas informacion del producto" / "informacion del producto" tiene
  // "producto" + "mas", que tambien dispara el patron de catalogo de
  // abajo -- pero ahi lo que de verdad quieren es la info de la pomada
  // (ver INGREDIENTE_KEYWORDS), no la tarjeta del catalogo.
  if (contieneAlguna(normalizado, INGREDIENTE_KEYWORDS)) return false;
  if (!normalizado.includes("producto")) return false;
  return CATALOGO_PALABRAS_INTENCION.some((p) => normalizado.includes(p));
}

// Casi todas las respuestas en fase "conversando" armaban su
// "nuevoEstado" desde cero (solo con fase: "conversando") -- eso esta
// bien para paso/cantidad/nombre/direccion/bloque (ya no importan
// fuera de un pedido activo), pero NO para el celular (celular,
// celularPedidoTemprano, celularTempranoIntentos): esos se tienen que
// preservar en TODA la conversacion sin importar que se conteste
// despues, si no se "olvida" el celular que ya se habia dado y se le
// vuelve a insistir de mas (caso real que encontro Vic: contesto
// "claro, <su numero>" y el bot igual seguia preguntando).
function conversando(estado: EstadoPedido): EstadoPedido {
  return {
    fase: "conversando",
    celular: estado.celular,
    celularPedidoTemprano: estado.celularPedidoTemprano,
    celularTempranoIntentos: estado.celularTempranoIntentos,
  };
}

function mostrarCatalogo(estado: EstadoPedido): ResultadoRespuestaPomada {
  return {
    respuesta: "¡Claro! Aquí tienes nuestro catálogo 👇",
    nuevoEstado: conversando(estado),
    mostrarCatalogo: true,
  };
}

const NUMEROS_TEXTO: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
};

function extraerCantidad(normalizado: string): number | null {
  const match = normalizado.match(/\b([1-9][0-9]?)\b/);
  if (match) {
    const n = parseInt(match[1], 10);
    if (n > 0 && n <= 50) return n;
  }
  for (const palabra of normalizado.split(" ")) {
    if (NUMEROS_TEXTO[palabra]) return NUMEROS_TEXTO[palabra];
  }
  return null;
}

// Celular: se queda nada mas con los ultimos 10 digitos que haya en el
// mensaje (igual de permisivo que el bot de citas, para no rechazar
// numeros escritos con espacios, guiones o el "+52" de México).
function extraerCelular(mensaje: string): string | null {
  const digits = mensaje.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

function interpretarEleccionMitad(normalizado: string): "A" | "B" | null {
  if (/\b(1|uno|primera|primero)\b/.test(normalizado)) return "A";
  if (/\b(2|dos|segunda|segundo)\b/.test(normalizado)) return "B";
  return null;
}

// --- Dia de entrega --------------------------------------------------
// Vic pidio que primero se pregunte EL DIA (ofreciendo de entrada
// "mañana mismo", que es lo que casi siempre se cierra), y ya hasta
// entonces se pregunte mañana/tarde -- antes se preguntaba mañana/tarde
// sin saber todavia que dia era, lo cual no tenia sentido porque el
// horario de entrega depende del dia que se escoja.

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// "Hoy" segun la hora de Monterrey/CDMX -- el servidor corre en UTC,
// asi que no basta con "new Date()" (podria ya ser otro dia alla).
function hoyMexico(): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Monterrey",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valores: Record<string, string> = {};
  for (const p of partes) valores[p.type] = p.value;
  return new Date(`${valores.year}-${valores.month}-${valores.day}T00:00:00`);
}

function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

function formatearFechaISO(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "viernes 28 de noviembre de 2026" -- Vic pidio explicitamente que se
// le diga dia, mes Y año, para que no quede ambiguo.
function formatearFechaLegible(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  return `${DIAS_SEMANA[fecha.getDay()]} ${d} de ${MESES[m - 1]} de ${y}`;
}

// Interpreta un dia que mencionen en texto libre -- "mañana", "pasado
// mañana", "hoy", o el nombre de un dia de la semana ("el viernes",
// "mejor jueves"). Si el dia de la semana ya paso esta semana (o es
// hoy mismo -- "hoy" se interpreta aparte, arriba), se asume el de la
// PROXIMA semana. No intenta reconocer fechas exactas tipo "el 5 de
// diciembre" (Vic pidio dejar eso fuera por ahora).
// "permitirRelativos" se apaga cuando el mensaje ya trae una negacion
// (ej. "no quiero mañana") -- si no, la palabra "mañana" se detectaria
// como si la estuvieran ESCOGIENDO de dia, cuando en realidad la estan
// RECHAZANDO. Los nombres de dias de la semana (lunes a domingo) se
// siguen reconociendo igual, negacion o no (ej. "no, mejor el viernes").
function interpretarDiaPedido(normalizado: string, permitirRelativos = true): string | null {
  const hoy = hoyMexico();
  if (permitirRelativos) {
    if (/\bpasado manana\b/.test(normalizado)) return formatearFechaISO(sumarDias(hoy, 2));
    if (/\bmanana\b/.test(normalizado)) return formatearFechaISO(sumarDias(hoy, 1));
    if (/\bhoy\b/.test(normalizado) || /\bmismo dia\b/.test(normalizado)) return formatearFechaISO(hoy);
  }
  for (let i = 0; i < DIAS_SEMANA.length; i++) {
    if (new RegExp(`\\b${DIAS_SEMANA[i]}\\b`).test(normalizado)) {
      let delta = (i - hoy.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      return formatearFechaISO(sumarDias(hoy, delta));
    }
  }
  return null;
}

function finalizarPedido(estado: EstadoPedido, horario: string): ResultadoRespuestaPomada {
  const cantidad = estado.cantidad ?? 1;
  const precioTotal = cantidad * PRECIO_UNITARIO;
  // El dia ya se confirmo antes (ver paso "dia_manana"/"dia_cual"), asi
  // que aqui se junta con el bloque de mañana/tarde para el resumen
  // final completo.
  const horarioConFecha = estado.fecha ? `${formatearFechaLegible(estado.fecha)}, ${horario}` : horario;
  const resumen =
    `¡Listo! Este es el resumen de su pedido:\n\n` +
    `• Producto: Pomada Barak Flex\n` +
    `• Cantidad: ${cantidad}\n` +
    `• Nombre: ${estado.nombre}\n` +
    `• Celular: ${estado.celular}\n` +
    `• Dirección: ${estado.direccion}\n` +
    `• Entrega: ${horarioConFecha}\n` +
    `• Total a pagar (contra entrega): $${precioTotal} MXN\n\n` +
    `El pago es hasta que reciba su pedido, sin anticipo 😊`;
  return {
    respuesta: resumen,
    nuevoEstado: conversando(estado),
    pedido: {
      nombre: estado.nombre ?? "",
      celular: estado.celular ?? "",
      cantidad,
      precioUnitario: PRECIO_UNITARIO,
      precioTotal,
      direccion: estado.direccion ?? "",
      horario: horarioConFecha,
    },
  };
}

function iniciarPedido(normalizado: string, estado: EstadoPedido): ResultadoRespuestaPomada {
  const cantidad = extraerCantidad(normalizado);
  // Igual que en conversando() de arriba -- el celular que ya se tenga
  // o ya se haya pedido NO se debe perder nada mas porque empieza el
  // pedido.
  const camposCelular = {
    celular: estado.celular,
    celularPedidoTemprano: estado.celularPedidoTemprano,
    celularTempranoIntentos: estado.celularTempranoIntentos,
  };
  if (cantidad) {
    return {
      respuesta: `¡Perfecto! Le preparamos ${cantidad} ${cantidad === 1 ? "pomada" : "pomadas"} de Barak Flex 🙌 ¿A nombre de quién hacemos el pedido?`,
      nuevoEstado: { fase: "pidiendo", paso: "nombre", cantidad, ...camposCelular },
    };
  }
  return {
    respuesta: `¡Con gusto! ¿Cuántas pomadas le mandamos? (cuestan $${PRECIO_UNITARIO} cada una, puede pedir las que quiera, y el envío es gratis 🚚)`,
    nuevoEstado: { fase: "pidiendo", paso: "cantidad", ...camposCelular },
  };
}

function manejarPidiendo(mensaje: string, normalizado: string, estado: EstadoPedido): ResultadoRespuestaPomada {
  if (estado.paso === "cantidad") {
    const cantidad = extraerCantidad(normalizado);
    if (!cantidad) {
      // Si en vez de un numero preguntaron otra cosa (ej. "de que esta
      // hecha la pomada", "quisiera informacion") -- antes se quedaba
      // repitiendo siempre "digame el numero" sin importar que
      // preguntaran, sin contestar nunca su pregunta de verdad. Ahora
      // se le contesta eso primero y se le repite la pregunta pendiente,
      // sin perder su lugar en el pedido.
      if (contieneAlguna(normalizado, INGREDIENTE_KEYWORDS)) {
        return {
          respuesta: `${INGREDIENTES_TEXT}\n\n¿Cuántas pomadas le mandamos?`,
          nuevoEstado: estado,
        };
      }
      return {
        respuesta: "Nada más dígame el número -- ¿cuántas pomadas le mandamos?",
        nuevoEstado: estado,
      };
    }
    return {
      respuesta: `Perfecto, ${cantidad} ${cantidad === 1 ? "pomada" : "pomadas"} 👍 ¿A nombre de quién hacemos el pedido?`,
      nuevoEstado: { ...estado, paso: "nombre", cantidad },
    };
  }

  if (estado.paso === "nombre") {
    const nombre = mensaje.trim();
    if (nombre.length < 2) {
      return { respuesta: "¿Me puede decir su nombre completo, por favor?", nuevoEstado: estado };
    }
    // Si ya se tiene su celular (se lo pidio desde el principio de la
    // conversacion, ver celularPedidoTemprano), no hace falta volver a
    // pedirlo aqui -- se usa ese mismo y se sigue derecho con la direccion.
    if (estado.celular) {
      return {
        respuesta:
          "Perfecto. ¿Cuál es la dirección completa donde se la entregamos? (calle, número y colonia) -- también le puede dar clic al pin 📍 de abajo para mandarnos su ubicación actual.",
        nuevoEstado: { ...estado, paso: "direccion", nombre },
        pedirUbicacion: true,
      };
    }
    return {
      respuesta: "Gracias. ¿A qué número de WhatsApp le confirmamos y avisamos cuando salga su pedido?",
      nuevoEstado: { ...estado, paso: "celular", nombre },
    };
  }

  if (estado.paso === "celular") {
    const celular = extraerCelular(mensaje);
    if (!celular) {
      return { respuesta: "No le entendí bien el número -- ¿me lo puede volver a mandar, con los 10 dígitos?", nuevoEstado: estado };
    }
    return {
      respuesta:
        "Perfecto. ¿Cuál es la dirección completa donde se la entregamos? (calle, número y colonia) -- también le puede dar clic al pin 📍 de abajo para mandarnos su ubicación actual.",
      nuevoEstado: { ...estado, paso: "direccion", celular },
      pedirUbicacion: true,
    };
  }

  if (estado.paso === "direccion") {
    const direccion = mensaje.trim();
    if (direccion.length < 6) {
      return { respuesta: "¿Me puede mandar su dirección completa (calle, número y colonia)?", nuevoEstado: estado };
    }
    // Primero se pregunta el DIA (ofreciendo de entrada "mañana
    // mismo", que es lo que casi siempre se cierra) -- ya hasta
    // entonces, en el paso "dia_manana"/"dia_cual" de abajo, se
    // pregunta mañana/tarde PARA ESE DIA.
    const manana = formatearFechaLegible(formatearFechaISO(sumarDias(hoyMexico(), 1)));
    return {
      respuesta: `¿Le gustaría que se la entreguemos mañana mismo (${manana})?`,
      nuevoEstado: { ...estado, paso: "dia_manana", direccion },
    };
  }

  if (estado.paso === "dia_manana") {
    // Contesto que si a "mañana mismo".
    if (esAfirmacion(normalizado, SI_KEYWORDS) && normalizado.split(" ").length <= 4) {
      const fecha = formatearFechaISO(sumarDias(hoyMexico(), 1));
      return {
        respuesta: "Perfecto, ¿la quiere en la mañana o en la tarde?",
        nuevoEstado: { ...estado, paso: "horario_bloque", fecha },
      };
    }
    // Dijo de una vez que dia prefiere (ej. "mejor el viernes") en vez
    // de solo decir que no -- no hace falta volver a preguntar. Si el
    // mensaje trae una negacion (ej. "no quiero mañana"), no se cuenta
    // la palabra "mañana" como si la estuviera escogiendo -- la esta
    // rechazando (ver permitirRelativos en interpretarDiaPedido).
    const diceQueNo = contieneFraseCompleta(normalizado, ["no"]) || contieneAlguna(normalizado, NO_KEYWORDS);
    const fechaDirecta = interpretarDiaPedido(normalizado, !diceQueNo);
    if (fechaDirecta) {
      return {
        respuesta: `Perfecto, el ${formatearFechaLegible(fechaDirecta)}. ¿La quiere en la mañana o en la tarde?`,
        nuevoEstado: { ...estado, paso: "horario_bloque", fecha: fechaDirecta },
      };
    }
    return {
      respuesta: "¿Qué día le gustaría que se la entreguemos?",
      nuevoEstado: { ...estado, paso: "dia_cual" },
    };
  }

  if (estado.paso === "dia_cual") {
    const fecha = interpretarDiaPedido(normalizado);
    if (!fecha) {
      return {
        respuesta: 'No le entendí bien el día -- ¿me puede decir, por ejemplo, "el viernes" o "pasado mañana"?',
        nuevoEstado: estado,
      };
    }
    return {
      respuesta: `Perfecto, el ${formatearFechaLegible(fecha)}. ¿La quiere en la mañana o en la tarde?`,
      nuevoEstado: { ...estado, paso: "horario_bloque", fecha },
    };
  }

  if (estado.paso === "horario_bloque") {
    const esManana = normalizado.includes("manana") || /\bam\b/.test(normalizado);
    const esTarde = normalizado.includes("tarde") || /\bpm\b/.test(normalizado);
    if (esManana && !esTarde) {
      return {
        respuesta: "Perfecto, la entrega en la mañana sería entre las 8:00am y las 2:00pm 🙂 ¿Le parece bien ese horario?",
        nuevoEstado: { ...estado, paso: "horario_confirmar", bloque: "manana" },
      };
    }
    if (esTarde && !esManana) {
      return {
        respuesta: "Perfecto, la entrega en la tarde sería entre las 2:00pm y las 8:00pm 🙂 ¿Le parece bien ese horario?",
        nuevoEstado: { ...estado, paso: "horario_confirmar", bloque: "tarde" },
      };
    }
    return { respuesta: "¿Prefiere que se la llevemos en la mañana o en la tarde?", nuevoEstado: estado };
  }

  if (estado.paso === "horario_confirmar") {
    if (contieneAlguna(normalizado, QUEJA_TIEMPO_KEYWORDS)) {
      const opciones =
        estado.bloque === "manana" ? ["8:00am a 11:00am", "11:00am a 2:00pm"] : ["2:00pm a 5:00pm", "5:00pm a 8:00pm"];
      return {
        respuesta: `Entiendo, lo acortamos a la mitad. ¿Cuál prefiere?\n1) ${opciones[0]}\n2) ${opciones[1]}`,
        nuevoEstado: { ...estado, paso: "horario_mitad" },
      };
    }
    const horario = estado.bloque === "manana" ? "Mañana (8:00am a 2:00pm)" : "Tarde (2:00pm a 8:00pm)";
    return finalizarPedido(estado, horario);
  }

  if (estado.paso === "horario_mitad") {
    const opciones =
      estado.bloque === "manana"
        ? ["Mañana (8:00am a 11:00am)", "Mañana (11:00am a 2:00pm)"]
        : ["Tarde (2:00pm a 5:00pm)", "Tarde (5:00pm a 8:00pm)"];
    const eleccion = interpretarEleccionMitad(normalizado);
    if (!eleccion) {
      return {
        respuesta: `Nada más dígame "1" o "2":\n1) ${opciones[0]}\n2) ${opciones[1]}`,
        nuevoEstado: estado,
      };
    }
    return finalizarPedido(estado, eleccion === "A" ? opciones[0] : opciones[1]);
  }

  // No deberia llegar aqui, pero por si acaso se reinicia el pedido.
  return iniciarPedido(normalizado, estado);
}

function calcularRespuestaBase(
  mensaje: string,
  normalizado: string,
  estado: EstadoPedido,
  canalPublico: boolean,
  anuncios: Anuncio[],
  bienvenida: BienvenidaItem[]
): ResultadoRespuestaPomada {
  if (estado.fase === "inicio") {
    if (!coincideConAnuncio(mensaje, anuncios) && !canalPublico) {
      return {
        respuesta:
          "⚠️ Este mensaje no coincide con ningún anuncio guardado. Puede que no venga de un clic a un anuncio de Facebook/Instagram -- revísalo tú mismo en vez de contestar el saludo automático.",
        nuevoEstado: conversando(estado),
        nota: "mensaje_no_de_anuncio",
      };
    }
    if (pareceQuererComprar(normalizado)) {
      return iniciarPedido(normalizado, estado);
    }
    const codigo = detectarCodigoAnuncio(mensaje);
    return {
      respuesta: bienvenida
        .filter((m) => m.tipo === "texto")
        .map((m) => m.contenido)
        .join("\n\n"),
      nuevoEstado: conversando(estado),
      nota: codigo ? `Código de anuncio detectado: ${codigo}` : undefined,
      mensajesBienvenida: bienvenida.length > 0 ? bienvenida : undefined,
    };
  }

  if (estado.fase === "pidiendo") {
    return manejarPidiendo(mensaje, normalizado, estado);
  }

  // fase === "conversando"
  if (contieneAlguna(normalizado, NO_KEYWORDS)) {
    return {
      respuesta: "Está bien, aquí quedo por si más al rato se le antoja o le late pedirla 😊",
      nuevoEstado: conversando(estado),
    };
  }
  // Ya se le pidio el celular y contesta diciendo que si lo va a dar,
  // pero el mensaje todavia no trae los digitos (ver CELULAR_PROMETIDO_KEYWORDS).
  if (estado.celularPedidoTemprano && !estado.celular && contieneAlguna(normalizado, CELULAR_PROMETIDO_KEYWORDS)) {
    return {
      respuesta: "¡Claro! Nada más mándeme los 10 dígitos de su WhatsApp, por favor 📱",
      nuevoEstado: conversando(estado),
    };
  }
  // Confirmaciones genericas sobre el dolor (ej. "¿y sirve para todos
  // esos dolores que dice?") van ANTES que DOLOR_KEYWORDS -- si no, la
  // palabra "dolor" ya haria que cayera en la respuesta normal (sin el
  // "¡Claro!" que si corresponde aqui porque de verdad preguntaron algo).
  if (contieneAlguna(normalizado, CONFIRMA_DOLOR_GENERAL_KEYWORDS)) {
    return { respuesta: respuestaDolorGeneral(), nuevoEstado: conversando(estado) };
  }
  // La intencion de compra manda sobre el comentario de dolor -- si
  // alguien dice "la quiero porque me duele la pierna", lo correcto es
  // seguir derecho con el pedido, no volver a preguntar si la quiere.
  // Pero si en ese mismo mensaje tambien cuenta cual es su dolor (ej.
  // "quisiera la pomada por un dolor de columna que no soporto"), antes
  // de seguir con el pedido se le reconoce el dolor primero -- Vic
  // reporto que el bot se brincaba directo a pedir el nombre sin
  // comentarle nada sobre el dolor que acababa de decir, y se sentia
  // frio/automatico.
  if (pareceQuererComprar(normalizado)) {
    const resultado = iniciarPedido(normalizado, estado);
    if (contieneAlguna(normalizado, DOLOR_KEYWORDS)) {
      const parte = detectarParteMencionada(normalizado);
      const empatia = `Lamento mucho ese dolor${parte ? ` en ${parte}` : ""}, la Pomada Barak Flex le va a ayudar muchísimo 💪\n\n`;
      return { ...resultado, respuesta: empatia + resultado.respuesta };
    }
    return resultado;
  }
  if (contieneAlguna(normalizado, DOLOR_KEYWORDS)) {
    return { respuesta: respuestaDolor(normalizado), nuevoEstado: conversando(estado) };
  }
  if (contieneAlguna(normalizado, ENTREGA_KEYWORDS)) {
    return { respuesta: respuestaEntrega(), nuevoEstado: conversando(estado) };
  }
  if (contieneAlguna(normalizado, HORARIO_ENTREGA_KEYWORDS)) {
    return { respuesta: respuestaHorarioEntrega(), nuevoEstado: conversando(estado) };
  }
  // El costo del envio se checa ANTES que PRECIO_KEYWORDS -- "cuanto
  // cuesta el envio" tambien dispara PRECIO_KEYWORDS (por "cuanto
  // cuesta"), pero si de verdad solo preguntan por el envio, la
  // respuesta correcta es nada mas esa, no el precio completo.
  if (parecePreguntaEnvio(normalizado)) {
    return { respuesta: respuestaEnvio(), nuevoEstado: conversando(estado) };
  }
  if (contieneAlguna(normalizado, INGREDIENTE_KEYWORDS)) {
    return {
      respuesta: `${INGREDIENTES_TEXT}\n\n¿Le gustaría que le hagamos su pedido?`,
      nuevoEstado: conversando(estado),
    };
  }
  if (contieneAlguna(normalizado, PRECIO_KEYWORDS)) {
    return { respuesta: respuestaPrecio(), nuevoEstado: conversando(estado) };
  }
  // Va DESPUES de DOLOR_KEYWORDS: si ya dijeron cual es su problema en
  // el mismo mensaje (ej. "necesidad, tengo fascitis plantar"), ya se
  // contesto arriba y no hace falta volver a preguntar.
  if (contieneAlguna(normalizado, NECESIDAD_SIN_DETALLE_KEYWORDS)) {
    return { respuesta: respuestaNecesidadSinDetalle(), nuevoEstado: conversando(estado) };
  }
  // Afirmacion cortita (ej. contestando "¿le gustaria pedirla?") -- solo
  // cuenta si el mensaje es corto Y la frase aparece como palabra
  // completa (ver contieneFraseCompleta -- "si" es muy corto y si no
  // se exige el espacio alrededor, hace falso positivo adentro de
  // palabras como "necesidad").
  if (esAfirmacion(normalizado, SI_KEYWORDS) && normalizado.split(" ").length <= 3) {
    return iniciarPedido(normalizado, estado);
  }

  if (canalPublico) {
    return {
      respuesta:
        "¡Con gusto le ayudo! 😊 ¿Le gustaría conocer más sobre la Pomada Barak Flex (para qué dolores ayuda, qué contiene, el precio), o ya quiere que le hagamos su pedido?",
      nuevoEstado: conversando(estado),
      nota: "no_entendido_publico",
    };
  }
  return {
    respuesta: "Mmm, no estoy seguro de cómo contestar eso todavía. Usa el botón de \"Enseñar respuesta\" de abajo para decirme qué debí haber dicho.",
    nuevoEstado: conversando(estado),
    nota: "sin_entrenar",
  };
}

export async function generarRespuestaPomada(args: {
  mensaje: string;
  estado: EstadoPedido;
  correcciones: Correccion[];
  anuncios?: Anuncio[];
  bienvenida?: BienvenidaItem[];
  canalPublico?: boolean;
}): Promise<ResultadoRespuestaPomada> {
  const { mensaje, estado, correcciones, anuncios = [], bienvenida = [], canalPublico = false } = args;
  const normalizado = normalizar(mensaje);

  // Igual que el bot de citas (ver CELULAR_TEMPRANO_TEXT en engine.ts):
  // si ya se le pidio el celular antes y todavia no lo tenemos, se revisa
  // si este mensaje YA es el numero -- si si, se guarda (asi, si se sale
  // a medio chat sin terminar su pedido, de todos modos se le puede
  // volver a contactar) y se le agradece antes de seguir con lo que sea
  // que toque contestar normalmente.
  let estadoConCelular = estado;
  let agradecerCelular = false;
  if (estado.celularPedidoTemprano && !estado.celular) {
    const celularDetectado = extraerCelular(mensaje);
    if (celularDetectado) {
      estadoConCelular = { ...estado, celular: celularDetectado };
      agradecerCelular = true;
    }
  }

  // El catalogo se puede pedir en cualquier momento de la platica, pero
  // nunca a mitad de un pedido ya empezado (fase "pidiendo") -- ahi se
  // le sigue el paso que haga falta como siempre, para no dejarlo a
  // medias.
  let resultado =
    estadoConCelular.fase !== "pidiendo" && pareceCatalogo(normalizado)
      ? mostrarCatalogo(estadoConCelular)
      : calcularRespuestaBase(mensaje, normalizado, estadoConCelular, canalPublico, anuncios, bienvenida);

  // Si Master ya ensenio exactamente que contestar ante este mensaje, se
  // usa ese texto -- el paso/estado que ya se calculo arriba se respeta
  // igual, para que la conversacion siga avanzando (igual que en el bot
  // de citas). Esto va ANTES de agregar lo del celular (ver abajo): si
  // no, una correccion ensenada borraria por completo la peticion del
  // celular que se le iba a pegar.
  const correccionExacta = correcciones.find((c) => c.disparador === normalizado);
  if (correccionExacta) {
    resultado = { ...resultado, respuesta: correccionExacta.respuesta, nota: "Respuesta aprendida" };
  }

  if (agradecerCelular) {
    resultado = { ...resultado, respuesta: `Gracias, ya quedó registrado.\n\n${resultado.respuesta}` };
  } else if (!estado.celularPedidoTemprano) {
    // Primer mensaje que la persona escribio de verdad (fase "inicio"
    // ya quedo atras) -- se le pide el celular aqui, pegado a lo que sea
    // que le hayamos contestado.
    resultado = {
      ...resultado,
      respuesta: `${resultado.respuesta}\n\n${CELULAR_TEMPRANO_TEXT}`,
      nuevoEstado: { ...resultado.nuevoEstado, celularPedidoTemprano: true },
    };
  } else if (!estado.celular) {
    // Ya se le pidio antes pero no contesto con su celular -- se le
    // insiste UNA sola vez mas, para no ser pesados.
    const intentos = estado.celularTempranoIntentos ?? 0;
    if (intentos < 1) {
      resultado = {
        ...resultado,
        respuesta: `${resultado.respuesta}\n\n${CELULAR_TEMPRANO_TEXT}`,
        nuevoEstado: { ...resultado.nuevoEstado, celularTempranoIntentos: intentos + 1 },
      };
    }
  }

  return resultado;
}

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
  paso?: "cantidad" | "nombre" | "celular" | "direccion" | "horario_bloque" | "horario_confirmar" | "horario_mitad";
  cantidad?: number;
  nombre?: string;
  celular?: string;
  direccion?: string;
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
  { claves: ["ciatica"], texto: "la ciática" },
  { claves: ["lumbar"], texto: "la zona lumbar" },
  { claves: ["espalda"], texto: "la espalda" },
  { claves: ["columna"], texto: "la columna" },
  { claves: ["hombro"], texto: "los hombros" },
  { claves: ["cervical"], texto: "las cervicales" },
  { claves: ["cuello"], texto: "el cuello" },
  { claves: ["mano"], texto: "las manos" },
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
];

function detectarParteMencionada(normalizado: string): string | null {
  for (const grupo of PARTES_CUERPO) {
    if (grupo.claves.some((c) => normalizado.includes(c))) return grupo.texto;
  }
  return null;
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
    `Trae Glucosamina, Condroitina, Citrato de Magnesio, Clavo, Ajo Negro, Alcanfor y Mentol. ` +
    `¿Le gustaría saber más, o que le hagamos su pedido?`
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
  if (!normalizado.includes("producto")) return false;
  return CATALOGO_PALABRAS_INTENCION.some((p) => normalizado.includes(p));
}

function mostrarCatalogo(): ResultadoRespuestaPomada {
  return {
    respuesta: "¡Claro! Aquí tienes nuestro catálogo 👇",
    nuevoEstado: { fase: "conversando" },
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

function finalizarPedido(estado: EstadoPedido, horario: string): ResultadoRespuestaPomada {
  const cantidad = estado.cantidad ?? 1;
  const precioTotal = cantidad * PRECIO_UNITARIO;
  const resumen =
    `¡Listo! Este es el resumen de su pedido:\n\n` +
    `• Producto: Pomada Barak Flex\n` +
    `• Cantidad: ${cantidad}\n` +
    `• Nombre: ${estado.nombre}\n` +
    `• Celular: ${estado.celular}\n` +
    `• Dirección: ${estado.direccion}\n` +
    `• Entrega: ${horario}\n` +
    `• Total a pagar (contra entrega): $${precioTotal} MXN\n\n` +
    `El pago es hasta que reciba su pedido, sin anticipo 😊`;
  return {
    respuesta: resumen,
    nuevoEstado: { fase: "conversando" },
    pedido: {
      nombre: estado.nombre ?? "",
      celular: estado.celular ?? "",
      cantidad,
      precioUnitario: PRECIO_UNITARIO,
      precioTotal,
      direccion: estado.direccion ?? "",
      horario,
    },
  };
}

function iniciarPedido(normalizado: string): ResultadoRespuestaPomada {
  const cantidad = extraerCantidad(normalizado);
  if (cantidad) {
    return {
      respuesta: `¡Perfecto! Le preparamos ${cantidad} ${cantidad === 1 ? "pomada" : "pomadas"} de Barak Flex 🙌 ¿A nombre de quién hacemos el pedido?`,
      nuevoEstado: { fase: "pidiendo", paso: "nombre", cantidad },
    };
  }
  return {
    respuesta: `¡Con gusto! ¿Cuántas pomadas le mandamos? (cuestan $${PRECIO_UNITARIO} cada una, puede pedir las que quiera, y el envío es gratis 🚚)`,
    nuevoEstado: { fase: "pidiendo", paso: "cantidad" },
  };
}

function manejarPidiendo(mensaje: string, normalizado: string, estado: EstadoPedido): ResultadoRespuestaPomada {
  if (estado.paso === "cantidad") {
    const cantidad = extraerCantidad(normalizado);
    if (!cantidad) {
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
    };
  }

  if (estado.paso === "direccion") {
    const direccion = mensaje.trim();
    if (direccion.length < 6) {
      return { respuesta: "¿Me puede mandar su dirección completa (calle, número y colonia)?", nuevoEstado: estado };
    }
    return {
      respuesta: "¿Prefiere que se la llevemos en la mañana o en la tarde?",
      nuevoEstado: { ...estado, paso: "horario_bloque", direccion },
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
  return iniciarPedido(normalizado);
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
        nuevoEstado: { fase: "conversando" },
        nota: "mensaje_no_de_anuncio",
      };
    }
    if (contieneAlguna(normalizado, COMPRAR_KEYWORDS)) {
      return iniciarPedido(normalizado);
    }
    const codigo = detectarCodigoAnuncio(mensaje);
    return {
      respuesta: bienvenida
        .filter((m) => m.tipo === "texto")
        .map((m) => m.contenido)
        .join("\n\n"),
      nuevoEstado: { fase: "conversando" },
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
      nuevoEstado: { fase: "conversando" },
    };
  }
  if (contieneAlguna(normalizado, DOLOR_KEYWORDS)) {
    return { respuesta: respuestaDolor(normalizado), nuevoEstado: { fase: "conversando" } };
  }
  if (contieneAlguna(normalizado, INGREDIENTE_KEYWORDS)) {
    return {
      respuesta: `${INGREDIENTES_TEXT}\n\n¿Le gustaría que le hagamos su pedido?`,
      nuevoEstado: { fase: "conversando" },
    };
  }
  if (contieneAlguna(normalizado, PRECIO_KEYWORDS)) {
    return { respuesta: respuestaPrecio(), nuevoEstado: { fase: "conversando" } };
  }
  if (contieneAlguna(normalizado, COMPRAR_KEYWORDS)) {
    return iniciarPedido(normalizado);
  }
  // Afirmacion cortita (ej. contestando "¿le gustaria pedirla?") -- solo
  // cuenta si el mensaje es corto, igual que en el bot de citas.
  if (contieneAlguna(normalizado, SI_KEYWORDS) && normalizado.split(" ").length <= 3) {
    return iniciarPedido(normalizado);
  }

  if (canalPublico) {
    return {
      respuesta:
        "¡Con gusto le ayudo! 😊 ¿Le gustaría conocer más sobre la Pomada Barak Flex (para qué dolores ayuda, qué contiene, el precio), o ya quiere que le hagamos su pedido?",
      nuevoEstado: { fase: "conversando" },
      nota: "no_entendido_publico",
    };
  }
  return {
    respuesta: "Mmm, no estoy seguro de cómo contestar eso todavía. Usa el botón de \"Enseñar respuesta\" de abajo para decirme qué debí haber dicho.",
    nuevoEstado: { fase: "conversando" },
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
      ? mostrarCatalogo()
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

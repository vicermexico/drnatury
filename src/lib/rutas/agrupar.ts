// Agrupa pedidos pendientes (con su ubicacion de GPS) en N rutas, cada
// una con el tamano que Master pida (ej. "2 rutas, 10 y 10"), juntando
// los que estan mas cerca uno de otro -- en linea recta, SIN usar
// ninguna API de mapas de paga (ver Fase 3, decision de Vic: "sencilla
// y gratis para empezar"). Si mas adelante se quiere una ruta mas
// precisa (considerando calles de verdad), se puede cambiar esta
// funcion por una que llame a Google Directions/Distance Matrix, sin
// tener que tocar nada de lo que la usa.

export interface PedidoUbicado {
  id: string;
  lat: number;
  lng: number;
}

export interface GrupoGenerado {
  pedidoIds: string[]; // ya en el orden sugerido de visita
}

// Distancia aproximada en KM entre dos coordenadas (formula de
// Haversine) -- de sobra para comparar "que tan cerca" estan dos
// pedidos dentro de la misma ciudad.
function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Ordena los puntos de un grupo ya armado con el metodo del "vecino mas
// cercano": empieza en uno (el mas al norponiente, nada mas para que
// sea consistente) y en cada paso salta al que le quede mas cerca de
// los que falten -- no es la ruta perfecta, pero evita el zigzag obvio
// de dejarlos en el orden en que se recibieron los pedidos.
function ordenarPorVecinoMasCercano(puntos: PedidoUbicado[]): PedidoUbicado[] {
  if (puntos.length <= 1) return puntos;
  const restantes = [...puntos];
  // Punto de partida: el que tenga la latitud mas alta (mas al norte);
  // nada mas para que el orden sea determinista, no tiene que ver con
  // donde vive el chofer.
  restantes.sort((a, b) => b.lat - a.lat);
  const ruta: PedidoUbicado[] = [restantes.shift()!];
  while (restantes.length > 0) {
    const actual = ruta[ruta.length - 1];
    let masCercanoIdx = 0;
    let menorDistancia = Infinity;
    for (let i = 0; i < restantes.length; i++) {
      const d = distanciaKm(actual, restantes[i]);
      if (d < menorDistancia) {
        menorDistancia = d;
        masCercanoIdx = i;
      }
    }
    ruta.push(restantes.splice(masCercanoIdx, 1)[0]);
  }
  return ruta;
}

// Agrupa "puntos" en grupos del tamano pedido en "tamanos" (ej. [10,
// 10]), juntando los que esten mas cerca. Metodo:
// 1) Se eligen tantas "semillas" como grupos se pidan, lo mas separadas
//    posible entre si (muestreo del punto mas lejano), para que cada
//    grupo arranque en una zona distinta del mapa.
// 2) Cada punto restante se va asignando, de uno en uno, al grupo mas
//    cercano que todavia no se haya llenado a su tamano pedido --
//    empezando por el punto que este mas cerca de CUALQUIER semilla
//    (para no dejar para el final, y mal repartidos, los puntos que ya
//    tenian un grupo obvio).
// 3) Dentro de cada grupo ya armado, se ordenan por cercania (ver
//    ordenarPorVecinoMasCercano) para sugerir un orden logico de visita.
//
// Si sobran puntos (la suma de "tamanos" es menor a la cantidad de
// pedidos), los que sobren se devuelven en un grupo aparte al final
// ("sinAsignar"), para que Master decida que hacer con ellos (ej. pedir
// una ruta mas, o repartirlos a mano).
export function agruparPorCercania(
  puntos: PedidoUbicado[],
  tamanos: number[]
): { grupos: GrupoGenerado[]; sinAsignar: string[] } {
  const k = tamanos.length;
  if (k === 0 || puntos.length === 0) {
    return { grupos: tamanos.map(() => ({ pedidoIds: [] })), sinAsignar: puntos.map((p) => p.id) };
  }

  // 1) Semillas lo mas separadas posible (farthest-point sampling).
  const semillas: PedidoUbicado[] = [puntos[0]];
  const disponibles = puntos.slice(1);
  while (semillas.length < Math.min(k, puntos.length) && disponibles.length > 0) {
    let mejorIdx = 0;
    let mejorDistanciaMinima = -Infinity;
    for (let i = 0; i < disponibles.length; i++) {
      const distanciaMinimaASemillas = Math.min(
        ...semillas.map((s) => distanciaKm(s, disponibles[i]))
      );
      if (distanciaMinimaASemillas > mejorDistanciaMinima) {
        mejorDistanciaMinima = distanciaMinimaASemillas;
        mejorIdx = i;
      }
    }
    semillas.push(disponibles.splice(mejorIdx, 1)[0]);
  }
  // Si piden mas rutas de las que hay semillas posibles (pocos puntos),
  // se repiten semillas -- igual nunca se les va a asignar mas de lo
  // que haya disponible.
  while (semillas.length < k) semillas.push(semillas[semillas.length % semillas.length]);

  const asignados: PedidoUbicado[][] = tamanos.map(() => []);
  const cupoRestante = [...tamanos];

  // 2) El resto de los puntos (los que no quedaron de semilla) se
  // asignan de uno en uno, empezando por el que este mas cerca de
  // cualquier semilla.
  const restantes = puntos.filter((p) => !semillas.includes(p));
  // Las semillas tambien cuentan como el primer punto de su grupo.
  semillas.forEach((s, i) => {
    if (i < k) {
      asignados[i].push(s);
      cupoRestante[i]--;
    }
  });

  const pendientes = [...restantes];
  while (pendientes.length > 0) {
    // De los que faltan, se busca el que este mas cerca de CUALQUIER
    // semilla (para repartir primero los casos obvios).
    let mejorPuntoIdx = 0;
    let mejorGrupoIdx = -1;
    let mejorDistancia = Infinity;
    for (let i = 0; i < pendientes.length; i++) {
      for (let g = 0; g < k; g++) {
        if (cupoRestante[g] <= 0) continue;
        const d = distanciaKm(semillas[g], pendientes[i]);
        if (d < mejorDistancia) {
          mejorDistancia = d;
          mejorPuntoIdx = i;
          mejorGrupoIdx = g;
        }
      }
    }
    if (mejorGrupoIdx === -1) break; // ya no hay cupo en ningun grupo
    asignados[mejorGrupoIdx].push(pendientes.splice(mejorPuntoIdx, 1)[0]);
    cupoRestante[mejorGrupoIdx]--;
  }

  return {
    grupos: asignados.map((grupo) => ({
      pedidoIds: ordenarPorVecinoMasCercano(grupo).map((p) => p.id),
    })),
    sinAsignar: pendientes.map((p) => p.id),
  };
}

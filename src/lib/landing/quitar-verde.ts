// Quita el fondo verde de una foto o de un video (sin inteligencia
// artificial, 100% en el navegador). Trabaja sobre los pixeles (RGBA).
// Replica del algoritmo usado en appvlc.
//   fuerza: 0 a 100. Mas fuerza = quita mas verde (util si quedan bordes verdes).

export interface RecorteVerde {
  datos: Uint8ClampedArray;
  ancho: number;
  alto: number;
  vacia: boolean;
}

// El paso de verdad (que tan verde es cada pixel, y que tanto se le
// quita de alpha) -- compartido por la foto (que despues recorta al
// contorno) y por el video (que NO recorta: cada cuadro debe quedar
// del mismo tamano que los demas, si no el video se ve brincando).
function quitarVerdePixeles(datos: Uint8ClampedArray, fuerza = 50): Uint8ClampedArray {
  const f = Math.min(100, Math.max(0, Number(fuerza) || 0));
  // "Que tan verde es" un pixel: (verde - el mayor de rojo y azul) / verde
  const desde = 0.45 - 0.0035 * f; // por debajo se queda tal cual
  const hasta = desde + 0.2; // por encima desaparece del todo
  const salida = new Uint8ClampedArray(datos.length);

  for (let i = 0; i < datos.length; i += 4) {
    const r = datos[i], b = datos[i + 2];
    let g = datos[i + 1];
    let a = datos[i + 3];
    const otro = Math.max(r, b);
    if (g >= 40 && g > otro) {
      const verdor = (g - otro) / g;
      if (verdor >= hasta) a = 0;
      else if (verdor > desde) a = Math.round(a * (1 - (verdor - desde) / (hasta - desde)));
      // quita el reflejo verde que queda en los bordes
      if (a > 0) g = otro + Math.round((g - otro) * 0.15);
    }
    salida[i] = r; salida[i + 1] = g; salida[i + 2] = b; salida[i + 3] = a;
  }
  return salida;
}

// Para fotos: ademas de quitar el verde, recorta la imagen al contorno
// de la persona (quita el "marco" vacio que sobra alrededor).
export function quitarVerde(
  datos: Uint8ClampedArray,
  ancho: number,
  alto: number,
  fuerza = 50
): RecorteVerde {
  const salida = quitarVerdePixeles(datos, fuerza);
  let minX = ancho, minY = alto, maxX = -1, maxY = -1;

  for (let i = 3, p = 0; i < salida.length; i += 4, p++) {
    if (salida[i] > 16) {
      const x = p % ancho, y = (p - x) / ancho;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // Todo quedo transparente: no se pudo separar a la persona
  if (maxX < 0) return { datos: salida, ancho, alto, vacia: true };

  const nuevoAncho = maxX - minX + 1, nuevoAlto = maxY - minY + 1;
  const recorte = new Uint8ClampedArray(nuevoAncho * nuevoAlto * 4);
  for (let y = 0; y < nuevoAlto; y++) {
    const origen = ((y + minY) * ancho + minX) * 4;
    recorte.set(salida.subarray(origen, origen + nuevoAncho * 4), y * nuevoAncho * 4);
  }
  return { datos: recorte, ancho: nuevoAncho, alto: nuevoAlto, vacia: false };
}

// Para video: se le quita el verde a UN cuadro, pero sin recortar --
// el video necesita que todos los cuadros midan siempre lo mismo (ver
// RecorteVerdeVideo.tsx, que llama esto cuadro por cuadro mientras se
// grava el resultado).
export function quitarVerdeCuadro(datos: Uint8ClampedArray, fuerza = 50): Uint8ClampedArray {
  return quitarVerdePixeles(datos, fuerza);
}

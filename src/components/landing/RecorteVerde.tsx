"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { quitarVerde } from "@/lib/landing/quitar-verde";

const LADO_MAXIMO = 1500;

const campo =
  "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-blue-400";

interface Props {
  orden: number;
  uploadFile: (file: File) => Promise<string>;
}

// Sube una foto con fondo verde, le quita el verde en el navegador (sin IA,
// sin servidor) y guarda el recorte como un nuevo personaje. Replica del
// componente "RecorteVerde" de appvlc.
export function RecorteVerde({ orden, uploadFile }: Props) {
  const router = useRouter();
  const [original, setOriginal] = useState<ImageData | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [fuerza, setFuerza] = useState(50);
  const [nombre, setNombre] = useState("");
  const [puesto, setPuesto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  // El recorte se recalcula al mover la barra
  const recorte = useMemo(
    () => (original ? quitarVerde(original.data, original.width, original.height, fuerza) : null),
    [original, fuerza]
  );

  useEffect(() => {
    const canvas = lienzo.current;
    if (!canvas || !recorte) return;
    canvas.width = recorte.ancho;
    canvas.height = recorte.alto;
    const copia = new ImageData(new Uint8ClampedArray(recorte.datos), recorte.ancho, recorte.alto);
    canvas.getContext("2d")?.putImageData(copia, 0, 0);
  }, [recorte]);

  async function elegir(archivo: File | undefined) {
    setError(null);
    setOriginal(null);
    if (!archivo) return;
    try {
      const imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" });
      const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
      const ancho = Math.max(1, Math.round(imagen.width * escala));
      const alto = Math.max(1, Math.round(imagen.height * escala));
      const hoja = document.createElement("canvas");
      hoja.width = ancho;
      hoja.height = alto;
      const contexto = hoja.getContext("2d", { willReadFrequently: true });
      if (!contexto) throw new Error("sin lienzo");
      contexto.drawImage(imagen, 0, 0, ancho, alto);
      setOriginal(contexto.getImageData(0, 0, ancho, alto));
      setNombreArchivo(archivo.name);
    } catch {
      setError("No pude abrir esa foto. Prueba con una foto JPG o PNG.");
    }
  }

  async function guardar() {
    const canvas = lienzo.current;
    if (!canvas || !recorte || recorte.vacia) return;
    setError(null);
    setOcupado(true);
    try {
      const blob = await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, "image/png"));
      if (!blob) {
        setError("No pude preparar la imagen.");
        return;
      }
      const file = new File([blob], "personaje.png", { type: "image/png" });
      const imagen_url = await uploadFile(file);
      const res = await fetch("/api/landing/personajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, puesto, imagen_url, orden }),
      });
      if (!res.ok) throw new Error();
      setOriginal(null);
      setNombre("");
      setPuesto("");
      setNombreArchivo("");
      if (entrada.current) entrada.current.value = "";
      router.refresh();
    } catch {
      setError("No se pudo guardar el personaje.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs text-gray-500">
        Sube una foto de la persona con <strong>fondo verde parejo</strong> (bien iluminada y sin verde en la
        ropa). La app le quita el verde sola; tú ajustas la barra si queda algún borde verde.
      </p>

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        disabled={ocupado}
        onChange={(e) => void elegir(e.target.files?.[0])}
        className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-700"
      />

      {original && recorte && (
        <>
          <div
            className="flex max-h-[50dvh] items-end justify-center overflow-hidden rounded-xl border border-gray-300 p-2"
            style={{
              backgroundImage:
                "linear-gradient(45deg,#ddd 25%,transparent 25%),linear-gradient(-45deg,#ddd 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ddd 75%),linear-gradient(-45deg,transparent 75%,#ddd 75%)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0,0 10px,10px -10px,-10px 0",
              backgroundColor: "#fff",
            }}
          >
            <canvas ref={lienzo} className="max-h-[46dvh] w-auto max-w-full" />
          </div>

          {recorte.vacia && (
            <p role="alert" className="text-sm text-red-600">
              No encontré a la persona: toda la foto se quitó. ¿El fondo es verde? Baja la fuerza o sube otra foto.
            </p>
          )}

          <label className="flex flex-col gap-2 text-sm text-gray-700">
            Cuánto verde quitar: {fuerza}
            <input
              type="range"
              min={0}
              max={100}
              value={fuerza}
              onChange={(e) => setFuerza(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <span className="text-xs text-gray-500">
              Si quedan bordes verdes, súbele. Si se le borra algo a la persona, bájale.
            </span>
          </label>

          <label className="flex flex-col gap-2 text-sm text-gray-700">
            Nombre
            <input
              type="text"
              value={nombre}
              maxLength={60}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Dr. Alejandro"
              className={campo}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-gray-700">
            Puesto (opcional)
            <input
              type="text"
              value={puesto}
              maxLength={60}
              onChange={(e) => setPuesto(e.target.value)}
              placeholder="Terapeuta"
              className={campo}
            />
          </label>

          <button
            type="button"
            onClick={() => void guardar()}
            disabled={ocupado || recorte.vacia || !nombre.trim()}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {ocupado ? "Guardando..." : `Guardar personaje (${nombreArchivo})`}
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

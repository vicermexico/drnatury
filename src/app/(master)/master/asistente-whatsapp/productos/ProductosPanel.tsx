"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BotSlug } from "@/lib/whatsapp-bot/bots";

interface Foto {
  id: string;
  url: string;
}

interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  envioTipo: "gratis" | "costo";
  envioCosto: number | null;
  pagoContraEntrega: boolean;
  fotos: Foto[];
}

async function subirFoto(productoId: string, file: File | Blob, filename: string): Promise<Foto> {
  const res = await fetch("/api/master/productos/fotos/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productoId, filename }),
  });
  const data = (await res.json()) as { path?: string; token?: string; publicUrl?: string; message?: string };
  if (!res.ok || !data.path || !data.token || !data.publicUrl) {
    throw new Error(data.message || "No se pudo iniciar la subida");
  }

  const supabase = createClient();
  const { error } = await supabase.storage.from("products").uploadToSignedUrl(data.path, data.token, file, {
    contentType: file.type || "image/png",
  });
  if (error) throw new Error(error.message);

  const res2 = await fetch(`/api/master/productos/${productoId}/fotos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: data.path, url: data.publicUrl }),
  });
  const foto = (await res2.json()) as Foto & { message?: string };
  if (!res2.ok) throw new Error(foto.message || "No se pudo guardar la foto");
  return { id: foto.id, url: foto.url };
}

// Quita un fondo verde (tipo "chroma key", como las fotos que Vic toma
// paradas sobre tela verde) de una foto ya subida: cualquier pixel
// donde el verde domine claramente sobre el rojo y el azul se vuelve
// transparente. Es automatico y sencillo -- no es una IA de recorte
// fino, asi que en fotos con sombras muy verdosas puede dejar un borde,
// pero para un fondo verde parejo funciona bien.
async function quitarFondoVerde(fotoUrl: string): Promise<Blob> {
  const resp = await fetch(fotoUrl);
  if (!resp.ok) throw new Error("No se pudo leer la foto");
  const srcBlob = await resp.blob();
  const bitmap = await createImageBitmap(srcBlob);

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(bitmap, 0, 0);

  const imagen = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imagen.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (g > 60 && g > r * 1.15 && g > b * 1.15) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(imagen, 0, 0);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen"))), "image/png");
  });
}

function BloqueEnvioPago({
  envioTipo,
  envioCosto,
  pagoContraEntrega,
  onEnvioTipo,
  onEnvioCosto,
  onPago,
}: {
  envioTipo: "gratis" | "costo";
  envioCosto: string;
  pagoContraEntrega: boolean;
  onEnvioTipo: (v: "gratis" | "costo") => void;
  onEnvioCosto: (v: string) => void;
  onPago: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 p-3">
      <p className="text-xs font-medium text-gray-500">Envío</p>
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={envioTipo === "gratis"} onChange={() => onEnvioTipo("gratis")} />
          Gratis
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={envioTipo === "costo"} onChange={() => onEnvioTipo("costo")} />
          Con costo
        </label>
        {envioTipo === "costo" && (
          <input
            value={envioCosto}
            onChange={(e) => onEnvioCosto(e.target.value)}
            inputMode="decimal"
            placeholder="$"
            className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
        )}
      </div>
      <p className="text-xs font-medium text-gray-500 pt-1">Pago</p>
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={pagoContraEntrega} onChange={() => onPago(true)} />
          Contra entrega
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={!pagoContraEntrega} onChange={() => onPago(false)} />
          Por adelantado
        </label>
      </div>
    </div>
  );
}

function FilaProducto({
  producto,
  onCambiado,
  onEliminado,
}: {
  producto: Producto;
  onCambiado: (p: Producto) => void;
  onEliminado: (id: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(producto.nombre);
  const [descripcion, setDescripcion] = useState(producto.descripcion ?? "");
  const [precio, setPrecio] = useState(String(producto.precio));
  const [envioTipo, setEnvioTipo] = useState(producto.envioTipo);
  const [envioCosto, setEnvioCosto] = useState(producto.envioCosto != null ? String(producto.envioCosto) : "");
  const [pagoContraEntrega, setPagoContraEntrega] = useState(producto.pagoContraEntrega);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [quitandoFondoId, setQuitandoFondoId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputFotoRef = useRef<HTMLInputElement>(null);

  async function guardar() {
    setError("");
    const precioNum = Number(precio);
    if (!nombre.trim() || !Number.isFinite(precioNum) || precioNum < 0) {
      setError("Revisa el nombre y el precio");
      return;
    }
    const envioCostoNum = envioTipo === "costo" ? Number(envioCosto) : null;
    if (envioTipo === "costo" && (!Number.isFinite(envioCostoNum) || (envioCostoNum ?? -1) < 0)) {
      setError("Revisa el costo de envío");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/master/productos/${producto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion: descripcion.trim(),
          precio: precioNum,
          envioTipo,
          envioCosto: envioCostoNum ?? undefined,
          pagoContraEntrega,
        }),
      });
      if (!res.ok) throw new Error();
      onCambiado({
        ...producto,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        precio: precioNum,
        envioTipo,
        envioCosto: envioCostoNum,
        pagoContraEntrega,
      });
      setEditando(false);
    } catch {
      setError("No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    const res = await fetch(`/api/master/productos/${producto.id}`, { method: "DELETE" });
    if (res.ok) onEliminado(producto.id);
  }

  async function agregarFoto(file: File) {
    setSubiendoFoto(true);
    try {
      const foto = await subirFoto(producto.id, file, file.name);
      onCambiado({ ...producto, fotos: [...producto.fotos, foto] });
    } catch {
      setError("No se pudo subir la foto");
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function quitarFoto(fotoId: string) {
    await fetch(`/api/master/productos/${producto.id}/fotos/${fotoId}`, { method: "DELETE" });
    onCambiado({ ...producto, fotos: producto.fotos.filter((f) => f.id !== fotoId) });
  }

  async function quitarFondo(foto: Foto) {
    setQuitandoFondoId(foto.id);
    setError("");
    try {
      const blob = await quitarFondoVerde(foto.url);
      const nueva = await subirFoto(producto.id, blob, "sin-fondo.png");
      await fetch(`/api/master/productos/${producto.id}/fotos/${foto.id}`, { method: "DELETE" });
      onCambiado({ ...producto, fotos: producto.fotos.map((f) => (f.id === foto.id ? nueva : f)) });
    } catch {
      setError("No se pudo quitar el fondo de esa foto");
    } finally {
      setQuitandoFondoId(null);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
      {editando ? (
        <div className="space-y-2">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del producto"
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción"
            rows={2}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            inputMode="decimal"
            placeholder="Precio"
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
          <BloqueEnvioPago
            envioTipo={envioTipo}
            envioCosto={envioCosto}
            pagoContraEntrega={pagoContraEntrega}
            onEnvioTipo={setEnvioTipo}
            onEnvioCosto={setEnvioCosto}
            onPago={setPagoContraEntrega}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditando(false)} className="text-xs px-3 py-1.5 text-gray-500">
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{producto.nombre}</p>
            {producto.descripcion && <p className="text-xs text-gray-500 mt-0.5">{producto.descripcion}</p>}
            <p className="text-sm text-emerald-700 font-medium mt-1">${producto.precio.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Envío: {producto.envioTipo === "gratis" ? "gratis" : `$${(producto.envioCosto ?? 0).toFixed(2)}`} ·{" "}
              {producto.pagoContraEntrega ? "pago contra entrega" : "pago por adelantado"}
            </p>
          </div>
          <button onClick={() => setEditando(true)} className="shrink-0 text-xs text-blue-600 hover:text-blue-700">
            Editar
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {producto.fotos.map((f) => (
          <div key={f.id} className="space-y-1">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-[repeating-conic-gradient(#e5e7eb_0%_25%,white_0%_50%)] bg-[length:8px_8px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => quitarFoto(f.id)}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center"
                title="Quitar foto"
              >
                ✕
              </button>
            </div>
            <button
              onClick={() => quitarFondo(f)}
              disabled={quitandoFondoId === f.id}
              className="w-16 text-center text-[10px] text-emerald-700 hover:text-emerald-800 disabled:opacity-60"
            >
              {quitandoFondoId === f.id ? "Quitando…" : "Quitar fondo verde"}
            </button>
          </div>
        ))}
        <button
          onClick={() => inputFotoRef.current?.click()}
          disabled={subiendoFoto}
          className="w-16 h-16 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-60"
        >
          {subiendoFoto ? "…" : "+ Foto"}
        </button>
        <input
          ref={inputFotoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) agregarFoto(file);
            e.target.value = "";
          }}
        />
      </div>

      <button onClick={eliminar} className="text-xs text-red-500 hover:text-red-700">
        Eliminar producto
      </button>
    </div>
  );
}

export function ProductosPanel({ bot }: { bot: BotSlug }) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [envioTipo, setEnvioTipo] = useState<"gratis" | "costo">("gratis");
  const [envioCosto, setEnvioCosto] = useState("");
  const [pagoContraEntrega, setPagoContraEntrega] = useState(true);
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/master/productos?bot=${bot}`);
      const data = (await res.json()) as { productos: Producto[] };
      setProductos(data.productos ?? []);
    } finally {
      setCargando(false);
    }
  }, [bot]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const precioNum = Number(precio);
    if (!nombre.trim()) {
      setError("Escribe el nombre del producto");
      return;
    }
    if (!Number.isFinite(precioNum) || precioNum < 0) {
      setError("Escribe un precio válido");
      return;
    }
    const envioCostoNum = envioTipo === "costo" ? Number(envioCosto) : undefined;
    if (envioTipo === "costo" && (!Number.isFinite(envioCostoNum) || (envioCostoNum ?? -1) < 0)) {
      setError("Escribe un costo de envío válido");
      return;
    }
    setCreando(true);
    try {
      const res = await fetch("/api/master/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot,
          nombre,
          descripcion: descripcion || undefined,
          precio: precioNum,
          envioTipo,
          envioCosto: envioCostoNum,
          pagoContraEntrega,
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "No se pudo crear el producto");
        return;
      }
      setNombre("");
      setDescripcion("");
      setPrecio("");
      setEnvioTipo("gratis");
      setEnvioCosto("");
      setPagoContraEntrega(true);
      await cargar();
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={crear} className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Agregar producto</h2>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre del producto"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción (para qué sirve, cómo se usa, etc.)"
          rows={3}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        <input
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          inputMode="decimal"
          placeholder="Precio (ej. 590)"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        <BloqueEnvioPago
          envioTipo={envioTipo}
          envioCosto={envioCosto}
          pagoContraEntrega={pagoContraEntrega}
          onEnvioTipo={setEnvioTipo}
          onEnvioCosto={setEnvioCosto}
          onPago={setPagoContraEntrega}
        />
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}
        <button
          type="submit"
          disabled={creando}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
        >
          {creando ? "Guardando…" : "Guardar producto"}
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Tus productos</h2>
        {cargando ? (
          <p className="text-sm text-gray-400">Cargando…</p>
        ) : productos.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no has subido ningún producto.</p>
        ) : (
          productos.map((p) => (
            <FilaProducto
              key={p.id}
              producto={p}
              onCambiado={(np) => setProductos((prev) => prev.map((x) => (x.id === np.id ? np : x)))}
              onEliminado={(id) => setProductos((prev) => prev.filter((x) => x.id !== id))}
            />
          ))
        )}
      </div>
    </div>
  );
}

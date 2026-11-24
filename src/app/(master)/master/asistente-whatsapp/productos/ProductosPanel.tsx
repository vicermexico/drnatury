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
  fotos: Foto[];
}

async function subirFoto(productoId: string, file: File): Promise<Foto> {
  const res = await fetch("/api/master/productos/fotos/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productoId, filename: file.name }),
  });
  const data = (await res.json()) as { path?: string; token?: string; publicUrl?: string; message?: string };
  if (!res.ok || !data.path || !data.token || !data.publicUrl) {
    throw new Error(data.message || "No se pudo iniciar la subida");
  }

  const supabase = createClient();
  const { error } = await supabase.storage.from("products").uploadToSignedUrl(data.path, data.token, file, {
    contentType: file.type,
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
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [error, setError] = useState("");
  const inputFotoRef = useRef<HTMLInputElement>(null);

  async function guardar() {
    setError("");
    const precioNum = Number(precio);
    if (!nombre.trim() || !Number.isFinite(precioNum) || precioNum < 0) {
      setError("Revisa el nombre y el precio");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/master/productos/${producto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), descripcion: descripcion.trim(), precio: precioNum }),
      });
      if (!res.ok) throw new Error();
      onCambiado({ ...producto, nombre: nombre.trim(), descripcion: descripcion.trim() || null, precio: precioNum });
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
      const foto = await subirFoto(producto.id, file);
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
          </div>
          <button onClick={() => setEditando(true)} className="shrink-0 text-xs text-blue-600 hover:text-blue-700">
            Editar
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {producto.fotos.map((f) => (
          <div key={f.id} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 group">
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
    setCreando(true);
    try {
      const res = await fetch("/api/master/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot, nombre, descripcion: descripcion || undefined, precio: precioNum }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "No se pudo crear el producto");
        return;
      }
      setNombre("");
      setDescripcion("");
      setPrecio("");
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

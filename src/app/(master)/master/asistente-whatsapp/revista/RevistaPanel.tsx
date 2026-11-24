"use client";

import { useEffect, useRef, useState } from "react";
import type { BotSlug } from "@/lib/whatsapp-bot/bots";

interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  fotos: { id: string; url: string }[];
}

// La libreria "page-flip" (https://github.com/Nodlik/StPageFlip) trae
// su propia clase PageFlip -- la importamos nada mas de tipos aqui
// porque el import real se hace adentro de useEffect (ver mas abajo),
// nunca arriba del archivo: su paquete esta pensado para el navegador
// (usa "self" desde el primer renglon), y si Next.js lo intentara
// correr tambien en el servidor al armar la pagina, tronaria.
type PageFlipInstancia = {
  loadFromHTML: (paginas: NodeListOf<HTMLElement> | HTMLElement[]) => void;
  on: (evento: "flip", cb: (e: { data: number }) => void) => void;
  destroy: () => void;
};

function formatoPrecio(n: number) {
  return `$${n.toFixed(2)}`;
}

export function RevistaPanel({ bot }: { bot: BotSlug }) {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [error, setError] = useState("");
  const [detalle, setDetalle] = useState<Producto | null>(null);
  const [pagActiva, setPagActiva] = useState(0);
  const libroRef = useRef<HTMLDivElement>(null);
  const marcoRef = useRef<HTMLDivElement>(null);
  const pageFlipRef = useRef<PageFlipInstancia | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/master/productos?bot=${bot}`);
        const data = (await res.json()) as { productos?: Producto[]; message?: string };
        if (cancelado) return;
        if (!res.ok) {
          setError(data.message || "No se pudieron cargar tus productos");
          return;
        }
        setProductos(data.productos ?? []);
      } catch {
        if (!cancelado) setError("No se pudieron cargar tus productos");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [bot]);

  // Arma las paginas del libro a mano (no con JSX) porque la libreria
  // necesita quedarse duena de esos nodos del DOM para animar el
  // doblez -- si React intentara volver a dibujarlos encima se
  // rompería la animación. Se vuelve a armar solo si cambia la lista
  // de productos.
  useEffect(() => {
    if (!productos || productos.length === 0 || !libroRef.current) return;
    let destruido = false;
    let instancia: PageFlipInstancia | null = null;

    (async () => {
      const { PageFlip } = await import("page-flip");
      if (destruido || !libroRef.current) return;

      const libroEl = libroRef.current;
      libroEl.innerHTML = "";
      productos.forEach((p, i) => {
        const foto = p.fotos[0]?.url;
        const pagina = document.createElement("div");
        pagina.className = "revista-pagina";
        pagina.innerHTML = `
          <div class="revista-foto">${
            foto
              ? `<img src="${foto}" alt="" />`
              : `<span class="revista-foto-vacia">🧴</span>`
          }</div>
          <div class="revista-info">
            <p class="revista-nombre">${p.nombre}</p>
            <p class="revista-precio">${formatoPrecio(p.precio)}</p>
            <div class="revista-botones">
              <button type="button" class="revista-btn-ver" data-i="${i}">Ver más</button>
              <button type="button" class="revista-btn-compartir" data-i="${i}">📤 Compartir</button>
            </div>
          </div>
        `;
        libroEl.appendChild(pagina);
      });

      const ancho = Math.min(300, Math.round((marcoRef.current?.clientWidth ?? 320) * 0.92));
      instancia = new PageFlip(libroEl, {
        width: ancho,
        height: Math.round(ancho * 1.4),
        size: "fixed",
        usePortrait: true,
        showCover: false,
        maxShadowOpacity: 0.5,
        flippingTime: 700,
        mobileScrollSupport: false,
      }) as unknown as PageFlipInstancia;
      instancia.loadFromHTML(libroEl.querySelectorAll(".revista-pagina"));
      instancia.on("flip", (e) => setPagActiva(e.data));
      pageFlipRef.current = instancia;
      setPagActiva(0);
    })();

    return () => {
      destruido = true;
      instancia?.destroy();
      pageFlipRef.current = null;
    };
  }, [productos]);

  useEffect(() => {
    const libroEl = libroRef.current;
    if (!libroEl || !productos) return;
    function onClick(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest("button[data-i]") as HTMLElement | null;
      if (!btn || !productos) return;
      const i = Number(btn.dataset.i);
      const p = productos[i];
      if (!p) return;
      if (btn.classList.contains("revista-btn-ver")) setDetalle(p);
      if (btn.classList.contains("revista-btn-compartir")) compartir(p);
    }
    libroEl.addEventListener("click", onClick);
    return () => libroEl.removeEventListener("click", onClick);
  }, [productos]);

  function compartir(p: Producto) {
    const texto = `Mira "${p.nombre}" -- ${formatoPrecio(p.precio)}`;
    if (navigator.share) {
      navigator.share({ title: p.nombre, text: texto }).catch(() => {});
    } else {
      alert("Desde el celular del cliente aquí se abre el menú para compartir por WhatsApp, etc.");
    }
  }

  if (error) {
    return <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>;
  }

  if (!productos) {
    return <p className="text-sm text-gray-400">Cargando…</p>;
  }

  if (productos.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        Todavía no has subido ningún producto -- súbelos primero en &quot;Productos&quot; para que aparezcan aquí.
      </p>
    );
  }

  return (
    <div className="revista-wrap">
      <div className="revista-marco" ref={marcoRef}>
        <div className="revista-lomo" />
        <div ref={libroRef} />
        <div className="revista-canto-der" />
      </div>
      <div className="revista-indicadores">
        {productos.map((p, i) => (
          <span key={p.id} className={i === pagActiva ? "activo" : ""} />
        ))}
      </div>

      {detalle && (
        <div className="revista-modal" onClick={(e) => e.target === e.currentTarget && setDetalle(null)}>
          <div className="revista-tarjeta">
            <div className="revista-foto-grande">
              {detalle.fotos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detalle.fotos[0].url} alt="" />
              ) : (
                <span>🧴</span>
              )}
            </div>
            <div className="revista-cuerpo">
              <h2>{detalle.nombre}</h2>
              <p className="revista-precio">{formatoPrecio(detalle.precio)}</p>
              {detalle.descripcion && <p className="revista-desc">{detalle.descripcion}</p>}
              <button type="button" className="revista-btn-ver" onClick={() => compartir(detalle)}>
                📤 Compartir
              </button>
            </div>
            <button type="button" className="revista-cerrar" onClick={() => setDetalle(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .revista-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 0 8px;
          background: radial-gradient(circle at 50% 0%, #16231b, #0e1410 60%);
          border-radius: 16px;
        }
        .revista-marco {
          position: relative;
          display: flex;
          align-items: stretch;
          filter: drop-shadow(0 18px 30px rgba(0, 0, 0, 0.5));
        }
        .revista-lomo {
          width: 30px;
          flex-shrink: 0;
          margin-right: -6px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            #b8b0a0 0%,
            #f6f3ea 22%,
            #fffefa 34%,
            #d9d2c0 52%,
            #8d8572 68%,
            #ada69a 80%,
            #cfc8b8 100%
          );
          box-shadow: inset -3px 0 5px rgba(0, 0, 0, 0.25), inset 2px 0 4px rgba(255, 255, 255, 0.5),
            2px 4px 10px rgba(0, 0, 0, 0.35);
          position: relative;
          z-index: 0;
        }
        .revista-canto-der {
          position: absolute;
          top: 7px;
          bottom: 7px;
          right: -9px;
          width: 9px;
          background: repeating-linear-gradient(90deg, #e7e2d4 0px, #e7e2d4 1.5px, #cfc9b8 1.5px, #cfc9b8 3px);
          border-radius: 0 3px 3px 0;
          box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.25);
        }
        .revista-marco > div:nth-child(2) {
          position: relative;
          z-index: 1;
        }
        .revista-pagina {
          position: relative;
          background: #fbf9f4;
          color: #241f18;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .revista-foto {
          flex: 1;
          background: #e9e4d8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 4rem;
        }
        .revista-foto img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .revista-info {
          padding: 16px 18px 18px;
          border-top: 1px solid rgba(0, 0, 0, 0.08);
        }
        .revista-nombre {
          font-weight: 700;
          font-size: 1.05rem;
          margin: 0 0 2px;
        }
        .revista-precio {
          color: #3fae6b;
          font-weight: 700;
          font-size: 1.1rem;
          margin: 0 0 10px;
        }
        .revista-botones {
          display: flex;
          gap: 8px;
        }
        .revista-botones button,
        button.revista-btn-ver,
        button.revista-btn-compartir {
          flex: 1;
          border: none;
          border-radius: 10px;
          padding: 10px 0;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
        }
        .revista-btn-ver {
          background: #3fae6b;
          color: white;
        }
        .revista-btn-compartir {
          background: #ece7da;
          color: #241f18;
        }
        .revista-indicadores {
          display: flex;
          gap: 6px;
          margin-top: 18px;
          margin-bottom: 20px;
        }
        .revista-indicadores span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.25);
        }
        .revista-indicadores span.activo {
          background: #3fae6b;
        }
        .revista-modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 10;
        }
        .revista-tarjeta {
          background: #fbf9f4;
          color: #241f18;
          border-radius: 16px;
          max-width: 340px;
          width: 100%;
          overflow: hidden;
        }
        .revista-foto-grande {
          height: 200px;
          background: #e9e4d8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 4.5rem;
        }
        .revista-foto-grande img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .revista-cuerpo {
          padding: 16px 18px 18px;
        }
        .revista-cuerpo h2 {
          margin: 0 0 6px;
          font-size: 1.15rem;
        }
        .revista-desc {
          font-size: 0.88rem;
          color: #514a3d;
          line-height: 1.4;
          margin: 0 0 14px;
        }
        .revista-cerrar {
          margin: 0 18px 18px;
          width: calc(100% - 36px);
          border: none;
          background: rgba(0, 0, 0, 0.06);
          color: #241f18;
          border-radius: 10px;
          padding: 10px 0;
          font-size: 0.85rem;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

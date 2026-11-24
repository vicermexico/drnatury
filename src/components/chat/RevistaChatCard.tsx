"use client";

import { useEffect, useRef, useState } from "react";
import "@/styles/stPageFlip.css";

export interface ProductoRevista {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  fotos: { id: string; url: string }[];
}

type PageFlipInstancia = {
  loadFromHTML: (paginas: NodeListOf<HTMLElement> | HTMLElement[]) => void;
  on: (evento: "flip", cb: (e: { data: number }) => void) => void;
  destroy: () => void;
};

function formatoPrecio(n: number) {
  return `$${n.toFixed(2)}`;
}

// Tarjeta del catalogo DENTRO del chat real del cliente (pedido de
// Vic): cuando el bot manda el catalogo, esta tarjeta "nace" grande
// tapando casi toda la pantalla y luego se achica/acomoda sola hasta
// quedar en su lugar normal dentro del chat -- se logra con la tecnica
// FLIP (se calcula cuanto hay que agrandarla y moverla para que al
// aparecer se vea como si cubriera la pantalla, y luego se anima nada
// mas el "transform" de regreso a su tamano real, sin mover el resto
// del chat ni romper el scroll).
export function RevistaChatCard({ productos }: { productos: ProductoRevista[] }) {
  const marcoRef = useRef<HTMLDivElement>(null);
  const libroRef = useRef<HTMLDivElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [detalle, setDetalle] = useState<ProductoRevista | null>(null);
  const [pagActiva, setPagActiva] = useState(0);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el || typeof window === "undefined") return;
    const endRect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const anchoGrande = vw * 0.94;
    const altoGrande = vh * 0.86;
    const escala = Math.max(anchoGrande / endRect.width, altoGrande / endRect.height);
    const centroInicioX = vw / 2;
    const centroInicioY = vh / 2;
    const centroFinX = endRect.left + endRect.width / 2;
    const centroFinY = endRect.top + endRect.height / 2;
    const trasladoX = centroInicioX - centroFinX;
    const trasladoY = centroInicioY - centroFinY;

    el.style.transition = "none";
    el.style.transform = `translate(${trasladoX}px, ${trasladoY}px) scale(${escala})`;
    el.style.position = "relative";
    el.style.zIndex = "5";
    // Forzar reflow para que el navegador aplique ese transform antes
    // de animarlo de regreso a su tamano real.
    void el.getBoundingClientRect();
    const id = requestAnimationFrame(() => {
      el.style.transition = "transform 650ms cubic-bezier(0.2, 0.8, 0.2, 1)";
      el.style.transform = "translate(0px, 0px) scale(1)";
    });
    return () => cancelAnimationFrame(id);
    // Solo se anima una vez, al aparecer.
  }, []);

  useEffect(() => {
    if (productos.length === 0 || !libroRef.current) return;
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
            foto ? `<img src="${foto}" alt="" />` : `<span class="revista-foto-vacia">🧴</span>`
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

      const ancho = Math.min(280, Math.round((marcoRef.current?.clientWidth ?? 300) * 0.92));
      instancia = new PageFlip(libroEl, {
        width: ancho,
        height: Math.round(ancho * 1.3),
        size: "fixed",
        usePortrait: true,
        showCover: false,
        maxShadowOpacity: 0.5,
        flippingTime: 700,
        mobileScrollSupport: false,
      }) as unknown as PageFlipInstancia;
      instancia.loadFromHTML(libroEl.querySelectorAll(".revista-pagina"));
      instancia.on("flip", (e) => setPagActiva(e.data));
    })();

    return () => {
      destruido = true;
      instancia?.destroy();
    };
  }, [productos]);

  useEffect(() => {
    const libroEl = libroRef.current;
    if (!libroEl) return;
    function onClick(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest("button[data-i]") as HTMLElement | null;
      if (!btn) return;
      const i = Number(btn.dataset.i);
      const p = productos[i];
      if (!p) return;
      if (btn.classList.contains("revista-btn-ver")) setDetalle(p);
      if (btn.classList.contains("revista-btn-compartir")) compartir(p);
    }
    libroEl.addEventListener("click", onClick);
    return () => libroEl.removeEventListener("click", onClick);
  }, [productos]);

  function compartir(p: ProductoRevista) {
    const texto = `Mira "${p.nombre}" -- ${formatoPrecio(p.precio)}`;
    if (navigator.share) {
      navigator.share({ title: p.nombre, text: texto }).catch(() => {});
    } else {
      alert("Aquí se abre el menú para compartir por WhatsApp, etc.");
    }
  }

  if (productos.length === 0) return null;

  return (
    <div ref={contenedorRef} className="revista-chat-contenedor">
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
        .revista-chat-contenedor {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 18px 8px 14px;
          background: radial-gradient(circle at 50% 0%, #16231b, #0e1410 60%);
          border-radius: 18px;
          will-change: transform;
        }
        .revista-marco {
          position: relative;
          display: flex;
          align-items: stretch;
          filter: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.5));
        }
        .revista-lomo {
          width: 24px;
          flex-shrink: 0;
          margin-right: -5px;
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
          top: 6px;
          bottom: 6px;
          right: -7px;
          width: 7px;
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
          font-size: 3.5rem;
        }
        .revista-foto img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .revista-info {
          padding: 14px 16px 16px;
          border-top: 1px solid rgba(0, 0, 0, 0.08);
        }
        .revista-nombre {
          font-weight: 700;
          font-size: 1rem;
          margin: 0 0 2px;
        }
        .revista-precio {
          color: #3fae6b;
          font-weight: 700;
          font-size: 1.05rem;
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
          padding: 9px 0;
          font-size: 0.82rem;
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
          margin-top: 14px;
        }
        .revista-indicadores span {
          width: 6px;
          height: 6px;
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
          z-index: 50;
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
          height: 190px;
          background: #e9e4d8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 4rem;
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
          font-size: 1.1rem;
        }
        .revista-desc {
          font-size: 0.86rem;
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

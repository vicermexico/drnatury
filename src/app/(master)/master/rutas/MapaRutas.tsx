"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

// Mapa de las rutas (Fase 3) -- en su propio archivo aparte, cargado
// con "next/dynamic" y ssr:false desde RutasPanel.tsx, porque Leaflet
// necesita el navegador (document/window) y truena si se intenta
// renderizar en el servidor.
//
// Se usan CircleMarker (circulos) en vez de los marcadores normales de
// Leaflet a proposito: los marcadores normales necesitan unos iconos en
// PNG que casi nunca cargan bien con el empaquetado de Next/Webpack --
// los circulos no necesitan ninguna imagen, se ven igual de claros en
// el mapa, y de paso se les puede dar un color distinto por ruta.

export interface PedidoPin {
  id: string;
  nombre: string;
  direccion: string;
  cantidad: number;
  horario: string;
  lat: number;
  lng: number;
  orden?: number | null;
}

export interface GrupoMapa {
  color: string;
  etiqueta: string;
  pedidos: PedidoPin[];
}

// Centro aproximado de Monterrey, N.L. -- nada mas para que el mapa
// abra ya centrado donde esta el negocio, sin tener que moverlo a mano
// cada vez.
const CENTRO_MONTERREY: [number, number] = [25.6866, -100.3161];

export function MapaRutas({ grupos }: { grupos: GrupoMapa[] }) {
  return (
    <div className="h-[420px] rounded-2xl overflow-hidden border border-gray-200">
      <MapContainer center={CENTRO_MONTERREY} zoom={11} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {grupos.map((grupo) =>
          grupo.pedidos.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={9}
              pathOptions={{ color: grupo.color, fillColor: grupo.color, fillOpacity: 0.85, weight: 2 }}
            >
              <Popup>
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold">{grupo.etiqueta}{p.orden ? ` · parada ${p.orden}` : ""}</p>
                  <p>{p.nombre}</p>
                  <p>{p.direccion}</p>
                  <p>{p.cantidad} pomada{p.cantidad !== 1 ? "s" : ""} · {p.horario}</p>
                </div>
              </Popup>
            </CircleMarker>
          ))
        )}
      </MapContainer>
    </div>
  );
}

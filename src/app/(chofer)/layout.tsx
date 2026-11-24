import { requireRole } from "@/lib/auth";

// Panel del chofer (Fase 3 del bot de venta de productos, ver
// pomada_pedidos) -- de proposito muy simple, pensado para usarse desde
// el celular del chofer en la calle, no desde escritorio. Por ahora solo
// tiene el dashboard (ver pagina), mientras se arma el resto de la Fase
// 3 (rutas del dia, marcar entregado/rechazado, etc.).
export default async function ChoferLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("CHOFER");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-[11px] text-gray-400">DrNatury · Choferes</p>
          {profile?.name && <p className="text-sm font-semibold text-gray-900">{profile.name}</p>}
        </div>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="text-xs text-gray-400 hover:text-gray-600">Salir</button>
        </form>
      </header>

      <main className="p-4">{children}</main>
    </div>
  );
}

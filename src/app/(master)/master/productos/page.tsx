import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";

// A diferencia de /master/inventario (que es "Inventarios": entradas,
// salidas, costos y stock por sucursal), esta pagina es solo el
// catalogo -- dar de alta los productos que se manejan, sin numeros de
// stock. Por eso usa la misma tabla `products` pero sin tocar
// `inventory_items`/`inventory_movements`.
async function getProductos() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select("id, name, description, image_url, is_active")
    .is("deleted_at", null)
    .order("name");
  return data ?? [];
}

export default async function ProductosPage() {
  const productos = await getProductos();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {productos.length} producto{productos.length !== 1 ? "s" : ""} en el catálogo
          </p>
        </div>
        <Link href="/master/productos/nuevo"
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition shrink-0">
          + Nuevo producto
        </Link>
      </div>

      {productos.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 text-sm mb-3">No hay productos en el catálogo</p>
          <Link href="/master/productos/nuevo" className="text-blue-600 text-sm underline">
            Dar de alta el primer producto
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {productos.map((p) => (
            <Link key={p.id} href={`/master/inventario/${p.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white border border-gray-200 px-4 py-3.5 hover:border-blue-300 hover:shadow-sm transition">
              {p.image_url ? (
                <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                  <Image src={p.image_url} alt={p.name} fill className="object-cover" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-base">📦</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                  {!p.is_active && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">Inactivo</span>
                  )}
                </div>
                {p.description && <p className="text-xs text-gray-400 truncate">{p.description}</p>}
              </div>
              <span className="text-gray-300 shrink-0">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

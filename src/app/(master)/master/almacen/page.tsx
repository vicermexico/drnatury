import { CardMenu } from "@/components/ui/CardMenu";

export default function AlmacenPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Almacén</h1>
        <p className="text-sm text-gray-500 mt-1">Catálogo de productos e inventario (entradas, salidas y costos)</p>
      </div>
      <CardMenu
        items={[
          { href: "/master/productos", icono: "🛍️", titulo: "Productos", descripcion: "Alta de los productos que manejamos" },
          { href: "/master/inventario", icono: "📦", titulo: "Inventarios", descripcion: "Entradas, salidas, costos y stock por sucursal" },
        ]}
      />
    </div>
  );
}

import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { VentasAlmacenForm } from "./VentasAlmacenForm";

async function getProductos() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("inventory_items")
    .select("quantity, products(id, name, image_url)")
    .eq("is_warehouse", true)
    .gt("quantity", 0);
  return (data ?? []).map(item => ({
    id: (item.products as {id:string;name:string;image_url:string|null}).id,
    name: (item.products as {id:string;name:string;image_url:string|null}).name,
    image_url: (item.products as {id:string;name:string;image_url:string|null}).image_url,
    quantity: item.quantity,
  }));
}

export default async function VentasAlmacenPage() {
  const user = await requireRole("ALMACENISTA");
  const productos = await getProductos();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ventas directas</h1>
        <p className="text-sm text-gray-500 mt-1">Registra una venta desde el almacen central</p>
      </div>
      <VentasAlmacenForm productos={productos} userId={user.id} />
    </div>
  );
}

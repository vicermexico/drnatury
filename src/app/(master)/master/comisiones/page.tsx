import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ComisionesForm } from "./ComisionesForm";

export const dynamic = "force-dynamic";

async function getData() {
  const admin = createAdminClient();
  const [productsRes, branchesRes, asistentesRes, configSucRes, configAsisRes] = await Promise.all([
    admin.from("products").select("id, name").eq("is_active", true).is("deleted_at", null).order("name"),
    admin.from("branches").select("id, name").eq("is_active", true).order("name"),
    admin.from("profiles").select("id, name, phone").contains("roles", ["ASISTENTE"]).is("deleted_at", null).order("name"),
    admin.from("comisiones_config_producto_sucursal").select("product_id, sucursal_id, monto"),
    admin.from("comisiones_config_producto_asistente").select("product_id, asistente_id, monto"),
  ]);

  const sucMap  = new Map((configSucRes.data  ?? []).map(c => [`${c.product_id}_${c.sucursal_id}`,  c.monto]));
  const asisMap = new Map((configAsisRes.data ?? []).map(c => [`${c.product_id}_${c.asistente_id}`, c.monto]));

  const branches   = branchesRes.data   ?? [];
  const asistentes = asistentesRes.data ?? [];

  const products = (productsRes.data ?? []).map(p => ({
    ...p,
    branches:   branches.map(b  => ({ ...b,  monto: sucMap.get(`${p.id}_${b.id}`)  ?? 0 })),
    asistentes: asistentes.map(a => ({ ...a,  monto: asisMap.get(`${p.id}_${a.id}`) ?? 0 })),
  }));

  return { products };
}

async function guardarProducto(formData: FormData) {
  "use server";
  const admin = createAdminClient();
  const productId = formData.get("product_id") as string;
  if (!productId) return;

  const sucEntries:  { product_id: string; sucursal_id:  string; monto: number }[] = [];
  const asisEntries: { product_id: string; asistente_id: string; monto: number }[] = [];

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("suc_"))
      sucEntries.push({ product_id: productId, sucursal_id: key.slice(4), monto: Number(value) || 0 });
    else if (key.startsWith("asis_"))
      asisEntries.push({ product_id: productId, asistente_id: key.slice(5), monto: Number(value) || 0 });
  }

  await Promise.all([
    sucEntries.length  > 0 ? admin.from("comisiones_config_producto_sucursal").upsert(sucEntries,  { onConflict: "product_id,sucursal_id"  }) : null,
    asisEntries.length > 0 ? admin.from("comisiones_config_producto_asistente").upsert(asisEntries, { onConflict: "product_id,asistente_id" }) : null,
  ]);

  revalidatePath("/master/comisiones");
}

export default async function ComisionesPage() {
  await requireRole("MASTER");
  const { products } = await getData();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comisiones</h1>
        <p className="text-sm text-gray-500 mt-1">Configura los montos por producto, sucursal y asistente</p>
      </div>
      <ComisionesForm products={products} guardarProducto={guardarProducto} />
    </div>
  );
}

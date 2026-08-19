import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAnyRole } from "@/lib/auth/api-guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardAnyRole("MASTER", "ALMACENISTA");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  const [productRes, movementsRes] = await Promise.all([
    admin.from("products")
      .select("id, name, description, min_weekly_quantity, is_active, inventory_items(quantity)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    admin.from("inventory_movements")
      .select("id, type, quantity_before, quantity_after, notes, performed_at, performer:profiles!performed_by(name)")
      .eq("product_id", id)
      .order("performed_at", { ascending: false })
      .limit(20),
  ]);

  if (!productRes.data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ product: productRes.data, movements: movementsRes.data ?? [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardAnyRole("MASTER", "ALMACENISTA");
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  const allowed = ["name", "description", "min_weekly_quantity", "is_active", "image_url"];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "NO_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("products")
    .update(updates)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, name")
    .maybeSingle();

  if (dbErr || !data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardAnyRole("MASTER", "ALMACENISTA");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  const { error: dbErr } = await admin
    .from("products")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id)
    .is("deleted_at", null);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ message: "Producto eliminado" });
}

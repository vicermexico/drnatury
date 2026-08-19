import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole, guardAnyRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const { error } = await guardAnyRole("MASTER", "ALMACENISTA");
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("products")
    .select("id, name, description, min_weekly_quantity, is_active, inventory_items(quantity)")
    .is("deleted_at", null)
    .order("name");

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`products:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const { name, description, min_weekly_quantity, image_url } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "El nombre del producto es obligatorio" },
      { status: 400 }
    );
  }

  const minQty = Number(min_weekly_quantity ?? 0);
  if (isNaN(minQty) || minQty < 0) {
    return NextResponse.json(
      { error: "INVALID_MIN_QTY", message: "El stock mínimo debe ser un número positivo" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("products")
    .insert({
      name: name.trim(),
      description: typeof description === "string" ? description.trim() || null : null,
      min_weekly_quantity: minQty,
      image_url: typeof image_url === "string" && image_url ? image_url : null,
    })
    .select("id, name")
    .single();

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

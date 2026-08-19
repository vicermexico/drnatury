import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  const { data, error: dbErr } = await admin
    .from("branches")
    .select(`
      id, name, address, lat, lng,
      simultaneous_capacity, is_active, schedule,
      branch_services(
        price,
        services(id, name, duration_minutes)
      )
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (dbErr || !data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  const allowed = ["name", "address", "simultaneous_capacity", "schedule", "is_active", "global_mode", "global_capacity", "mostrar_celular"];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "NO_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("branches")
    .update(updates)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, name")
    .single();

  if (dbErr || !data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  // Soft delete â€” CLAUDE.md regla 1
  const { error: dbErr } = await admin
    .from("branches")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id)
    .is("deleted_at", null);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ message: "Sucursal eliminada" });
}



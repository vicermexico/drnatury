import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("profiles")
    .select("id, name, phone, email, branch_id, is_active, branches(id, name)")
    .eq("id", id)
    .contains("roles", ["TERAPEUTA"])
    .is("deleted_at", null)
    .maybeSingle();

  if (dbErr || !data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
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

  const allowed = ["name", "email", "branch_id", "is_active"];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "NO_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .contains("roles", ["TERAPEUTA"])
    .is("deleted_at", null)
    .select("id, name")
    .single();

  if (dbErr || !data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  // Soft delete — CLAUDE.md regla 1
  const { error: dbErr } = await admin
    .from("profiles")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id)
    .contains("roles", ["TERAPEUTA"])
    .is("deleted_at", null);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  // Anonimizar el email en auth.users para que el número de celular
  // quede disponible para registrar otro terapeuta.
  await admin.auth.admin.updateUserById(id, {
    email: `deleted_${Date.now()}_${id}@deleted.invalid`,
  });

  return NextResponse.json({ message: "Terapeuta eliminada" });
}

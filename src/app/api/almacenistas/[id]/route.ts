import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { phoneToEmail } from "@/lib/auth/patient-secret";

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
    .select("id, name, phone, email, is_active")
    .eq("id", id)
    .contains("roles", ["ALMACENISTA"])
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
  const admin = createAdminClient();

  // Cambio de teléfono — actualiza auth.users también
  if (body.phone !== undefined) {
    const newPhone = String(body.phone).replace(/\D/g, "");
    if (newPhone.length < 10) {
      return NextResponse.json(
        { error: "INVALID_PHONE", message: "Ingresa un teléfono válido de 10 dígitos" },
        { status: 400 }
      );
    }

    const { data: conflict } = await admin
      .from("profiles")
      .select("id")
      .eq("phone", newPhone)
      .is("deleted_at", null)
      .neq("id", id)
      .maybeSingle();

    if (conflict) {
      return NextResponse.json(
        { error: "ALREADY_EXISTS", message: "Este número ya está registrado en el sistema" },
        { status: 409 }
      );
    }

    const { error: authErr } = await admin.auth.admin.updateUserById(id, {
      email: phoneToEmail(newPhone),
    });
    if (authErr) {
      return NextResponse.json(
        { error: "AUTH_ERROR", message: "Error al actualizar el acceso" },
        { status: 500 }
      );
    }

    const { error: phoneErr } = await admin
      .from("profiles")
      .update({ phone: newPhone })
      .eq("id", id)
      .contains("roles", ["ALMACENISTA"])
      .is("deleted_at", null);

    if (phoneErr) {
      return NextResponse.json({ error: "DB_ERROR", message: phoneErr.message }, { status: 500 });
    }
  }

  const allowed = ["name", "email", "is_active"];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );

  if (Object.keys(updates).length === 0 && body.phone === undefined) {
    return NextResponse.json({ error: "NO_FIELDS" }, { status: 400 });
  }

  if (Object.keys(updates).length > 0) {
    const { error: dbErr } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .contains("roles", ["ALMACENISTA"])
      .is("deleted_at", null);

    if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ id, updated: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  const { error: dbErr } = await admin
    .from("profiles")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id)
    .contains("roles", ["ALMACENISTA"])
    .is("deleted_at", null);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });

  await admin.auth.admin.updateUserById(id, {
    email: `deleted-${id}@drbioeescaner.invalid`,
  });

  return NextResponse.json({ message: "Almacenista eliminado" });
}

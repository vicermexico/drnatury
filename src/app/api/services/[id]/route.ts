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
    .from("services")
    .select("id, name, duration_minutes, is_active, simultaneous_capacity")
    .eq("id", id)
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

  const allowed = ["name", "duration_minutes", "is_active", "simultaneous_capacity"];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );

  if ("duration_minutes" in updates) {
    const duration = Number(updates.duration_minutes);
    if (!Number.isInteger(duration) || duration < 30 || duration % 30 !== 0) {
      return NextResponse.json(
        { error: "INVALID_DURATION", message: "La duraciÃ³n debe ser mÃºltiplo de 30 min" },
        { status: 400 }
      );
    }
    updates.duration_minutes = duration;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "NO_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("services")
    .update(updates)
    .eq("id", id)
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

  // Soft delete â€” CLAUDE.md regla 1
  const { error: dbErr } = await admin
    .from("services")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id)
    .is("deleted_at", null);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ message: "Servicio eliminado" });
}



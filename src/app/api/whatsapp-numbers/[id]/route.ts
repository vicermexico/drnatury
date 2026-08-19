import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { is_active?: boolean };

  if (typeof body.is_active !== "boolean") {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("whatsapp_numbers")
    .update({ is_active: body.is_active })
    .eq("id", id)
    .select("id, phone, is_active, display_order")
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

  const { error: dbErr } = await admin
    .from("whatsapp_numbers")
    .delete()
    .eq("id", id);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ message: "Número eliminado" });
}

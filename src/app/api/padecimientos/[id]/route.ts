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
  const body = (await request.json().catch(() => ({}))) as {
    nombre?: string;
    recomendacion?: string;
    orden?: number;
  };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.nombre === "string") update.nombre = body.nombre.trim();
  if (typeof body.recomendacion === "string") update.recomendacion = body.recomendacion;
  if (typeof body.orden === "number") update.orden = body.orden;

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("padecimientos")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
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
  const { error: dbErr } = await admin.from("padecimientos").delete().eq("id", id);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

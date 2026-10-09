import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

// Manual de apoyo para Iris: entradas de texto por tema (estomago,
// huesos, etc.) escritas por Master. Solo Master las administra. El
// endpoint de comparacion (/api/iris/compare) las lee directamente de la
// base de datos para incluirlas en el prompt de la IA.

export async function GET() {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("iris_manual_entries")
    .select("id, topic, content, created_at")
    .is("deleted_at", null)
    .order("topic");

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const { error, userId } = await guardRole("MASTER");
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as { topic?: string; content?: string };
  const { topic, content } = body;
  if (!topic || !content) return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("iris_manual_entries")
    .insert({ topic, content, created_by: userId })
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

  const admin = createAdminClient();
  const { error: dbErr } = await admin
    .from("iris_manual_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

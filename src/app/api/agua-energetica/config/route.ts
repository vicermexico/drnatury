import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("agua_energetica_config")
    .select("*")
    .single();
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("agua_energetica_config")
    .select("id")
    .single();

  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const { data, error: dbErr } = await admin
    .from("agua_energetica_config")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", existing.id)
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  return NextResponse.json(data);
}

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

// PATCH — actualiza el body de un template (solo MASTER)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { key } = await params;
  const body = await request.json().catch(() => ({})) as { body?: string };

  if (!body.body || body.body.trim().length === 0) {
    return NextResponse.json(
      { error: "EMPTY_BODY", message: "El contenido del template no puede estar vacío" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("whatsapp_templates")
    .update({ body: body.body.trim() })
    .eq("key", key)
    .select("key, body, updated_at")
    .single();

  if (dbErr || !data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(data);
}

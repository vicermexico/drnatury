import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

// El terapeuta edita su propio perfil (por ahora solo su numero de
// WhatsApp, distinto al celular con el que entra al sistema).
export async function PATCH(request: NextRequest) {
  const { error, userId } = await guardRole("TERAPEUTA");
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as {
    whatsapp_number?: string;
  };
  const whatsapp = body.whatsapp_number?.replace(/\D/g, "") ?? "";

  const admin = createAdminClient();
  const { error: dbErr } = await admin
    .from("profiles")
    .update({ whatsapp_number: whatsapp || null, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

// Borra un link del catalogo (no borra los leads historicos que ya
// trajo -- esos se quedan igual en chat_leads, nada mas deja de
// aparecer en la lista para generar links nuevos con ese mismo texto).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();
  const { error: dbErr } = await admin.from("whatsapp_bot_links").delete().eq("id", id);
  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  return NextResponse.json({ message: "Link eliminado" });
}

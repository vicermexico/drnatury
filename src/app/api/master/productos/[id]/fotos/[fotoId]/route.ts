import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

// DELETE: quita una foto del producto -- borra el registro y tambien el
// archivo real del Storage (aqui si se puede borrar de verdad, son
// nada mas fotos del catalogo, no datos de pacientes).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fotoId: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id, fotoId } = await params;
  const admin = createAdminClient();

  const { data: foto } = await admin
    .from("producto_fotos")
    .select("path")
    .eq("id", fotoId)
    .eq("producto_id", id)
    .maybeSingle();

  const { error: dbErr } = await admin.from("producto_fotos").delete().eq("id", fotoId);
  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  if (foto?.path) {
    await admin.storage.from("products").remove([foto.path]);
  }

  return NextResponse.json({ message: "Foto eliminada" });
}

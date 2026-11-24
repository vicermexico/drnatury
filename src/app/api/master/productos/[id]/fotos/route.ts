import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

// POST: ya que el navegador subio la foto directo al Storage (ver
// /api/master/productos/fotos/upload), aqui se guarda el registro en
// producto_fotos para que aparezca ligada a ese producto.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { path?: string; url?: string };
  if (!body.path || !body.url) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta la foto subida" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("producto_fotos")
    .select("id", { count: "exact", head: true })
    .eq("producto_id", id);

  const { data: foto, error: dbErr } = await admin
    .from("producto_fotos")
    .insert({ producto_id: id, path: body.path, url: body.url, orden: count ?? 0 })
    .select("id, url")
    .single();

  if (dbErr || !foto) {
    return NextResponse.json({ error: "DB_ERROR", message: dbErr?.message }, { status: 500 });
  }

  return NextResponse.json({ id: foto.id, url: foto.url }, { status: 201 });
}

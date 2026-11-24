import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

// PATCH: edita nombre/descripcion/precio de un producto ya existente.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    nombre?: string;
    descripcion?: string;
    precio?: number;
  };

  const patch: Record<string, unknown> = {};
  if (body.nombre !== undefined) {
    const nombre = body.nombre.trim();
    if (!nombre) {
      return NextResponse.json({ error: "MISSING_FIELDS", message: "El nombre no puede quedar vacío" }, { status: 400 });
    }
    patch.nombre = nombre;
  }
  if (body.descripcion !== undefined) patch.descripcion = body.descripcion.trim() || null;
  if (body.precio !== undefined) {
    const precio = Number(body.precio);
    if (!Number.isFinite(precio) || precio < 0) {
      return NextResponse.json({ error: "INVALID_PRECIO", message: "El precio no es válido" }, { status: 400 });
    }
    patch.precio = precio;
  }

  const admin = createAdminClient();
  const { error: dbErr } = await admin.from("productos").update(patch).eq("id", id);
  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  return NextResponse.json({ message: "Producto actualizado" });
}

// DELETE: soft-delete (CLAUDE.md -- "products" exige soft delete, nunca
// borrado real). No borra las fotos ya subidas al Storage; nada mas deja
// de aparecer en el catalogo.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();
  const { error: dbErr } = await admin
    .from("productos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  return NextResponse.json({ message: "Producto eliminado" });
}

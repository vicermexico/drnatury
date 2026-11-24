import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

// PATCH: asignarle (o quitarle) un chofer a una ruta ya armada.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { chofer_id?: string | null };
  const admin = createAdminClient();

  if (body.chofer_id) {
    const { data: chofer } = await admin
      .from("profiles")
      .select("id")
      .eq("id", body.chofer_id)
      .contains("roles", ["CHOFER"])
      .is("deleted_at", null)
      .maybeSingle();
    if (!chofer) {
      return NextResponse.json({ error: "CHOFER_INVALIDO", message: "Ese chofer no existe" }, { status: 400 });
    }
  }

  const { error: dbErr } = await admin
    .from("rutas_entrega")
    .update({ chofer_id: body.chofer_id ?? null })
    .eq("id", id);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json({ id, updated: true });
}

// DELETE: deshace la ruta -- los pedidos que traia regresan al grupo de
// "pendientes sin ruta" (no se borra ningun pedido, nada mas se le
// quita la ruta), por si el agrupado automatico no quedo bien y Master
// prefiere volver a generarla.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  await admin
    .from("pomada_pedidos")
    .update({ ruta_id: null, orden_en_ruta: null })
    .eq("ruta_id", id);

  const { error: dbErr } = await admin.from("rutas_entrega").delete().eq("id", id);
  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  return NextResponse.json({ message: "Ruta deshecha" });
}

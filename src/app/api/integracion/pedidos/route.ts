import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function checkApiKey(request: NextRequest): boolean {
  const key = request.headers.get("x-api-key");
  return key === process.env.BIORED_API_KEY;
}

export async function POST(request: NextRequest) {
  if (!checkApiKey(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const { pedido_id, usuario_nombre, usuario_celular, sucursal_id, productos, total, total_tokens, tipo, nip_entrega } = body;

  if (!pedido_id || !usuario_nombre || !usuario_celular) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "pedido_id, usuario_nombre y usuario_celular son obligatorios" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pedidos_biored")
    .insert({
      pedido_id:       String(pedido_id),
      usuario_nombre:  String(usuario_nombre),
      usuario_celular: String(usuario_celular),
      sucursal_id:     sucursal_id ? String(sucursal_id) : null,
      productos:       productos ?? [],
      total:           Number(total ?? 0),
      total_tokens:    total_tokens != null ? Number(total_tokens) : null,
      tipo:            String(tipo ?? "biored"),
      nip_entrega:     nip_entrega ? String(nip_entrega) : null,
      estado:          "pendiente",
    })
    .select("id, pedido_id, estado, created_at")
    .single();

  if (error) return NextResponse.json({ error: "DB_ERROR", message: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function checkApiKey(request: NextRequest): boolean {
  const key = request.headers.get("x-api-key");
  return key === process.env.BIORED_API_KEY;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkApiKey(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { estado?: string };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pedidos_biored")
    .update({ estado: body.estado ?? "entregado" })
    .eq("id", id)
    .select("id, pedido_id, estado")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(data);
}

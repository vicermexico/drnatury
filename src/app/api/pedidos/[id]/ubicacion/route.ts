import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyConfirmToken } from "@/lib/appointments/tokens";
import { checkRateLimit } from "@/lib/rate-limit";

// Igual que /api/appointments/[id]/ubicacion, pero para un PEDIDO de la
// Pomada Barak Flex (ver Fase 2 del bot de venta de productos): el
// cliente (sin login, con el mismo pin 📍 que ya usa el chat para
// citas a domicilio) comparte su ubicacion actual, y se guarda en el
// pedido para que en la Fase 3 el mapa de choferes la pueda usar.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    if (!checkRateLimit(`pedido-ubicacion:${ip}`, 20, 60_000)) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({})) as {
      token?: string;
      lat?: number;
      lng?: number;
    };
    const { token, lat, lng } = body;

    if (!token || !verifyConfirmToken(id, token)) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: "MISSING_FIELDS", message: "Falta la ubicacion" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: pedido } = await admin.from("pomada_pedidos").select("id").eq("id", id).maybeSingle();
    if (!pedido) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const { error: updateError } = await admin.from("pomada_pedidos").update({ lat, lng }).eq("id", id);
    if (updateError) return NextResponse.json({ error: "DB_ERROR", message: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error en PATCH /api/pedidos/[id]/ubicacion:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { enviarPushDirecto } from "@/lib/push/send";

// Fase 3 (panel del chofer): el chofer marca un pedido como entregado o
// rechazado. Se verifica que el pedido de verdad este en una ruta
// asignada a ESTE chofer (nunca se confia en el id que manda el
// navegador sin mas) y, si el cliente activo notificaciones en el chat
// (ver push_token en chat_leads), se le avisa ahi mismo -- decision de
// Vic: push al cliente en vez de WhatsApp, reusando el mismo permiso
// que ya existe en el chat publico (ver "¿Si se sale, le gustaria que
// le avisaramos...?" en PublicChatDemo.tsx).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`chofer-pedido-estado:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error, userId } = await guardRole("CHOFER");
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as {
    estado?: "entregado" | "rechazado";
    motivo?: string;
  };

  if (body.estado !== "entregado" && body.estado !== "rechazado") {
    return NextResponse.json({ error: "ESTADO_INVALIDO" }, { status: 400 });
  }
  if (body.estado === "rechazado" && !body.motivo?.trim()) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "Dime por qué no se pudo entregar" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // El pedido debe estar en una ruta que de verdad sea de este chofer.
  const { data: pedido } = await admin
    .from("pomada_pedidos")
    .select("id, ruta_id, rutas_entrega(chofer_id)")
    .eq("id", id)
    .maybeSingle();

  const rutaDelPedido = pedido?.rutas_entrega as unknown as { chofer_id: string | null } | null;
  if (!pedido || !pedido.ruta_id || rutaDelPedido?.chofer_id !== userId) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { error: dbErr } = await admin
    .from("pomada_pedidos")
    .update({
      estado: body.estado,
      entregado_at: new Date().toISOString(),
      motivo_rechazo: body.estado === "rechazado" ? body.motivo!.trim() : null,
    })
    .eq("id", id);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  // Avisarle al cliente, si activo notificaciones en el chat -- esto es
  // best-effort, nunca bloquea la respuesta al chofer si falla o si de
  // plano no activo nada.
  const { data: chatLead } = await admin
    .from("chat_leads")
    .select("push_token")
    .eq("pedido_id", id)
    .not("push_token", "is", null)
    .maybeSingle();

  if (chatLead?.push_token) {
    const mensaje =
      body.estado === "entregado"
        ? "¡Tu pedido de Pomada Barak Flex ya fue entregado! Gracias por tu compra 😊"
        : `No pudimos entregarte tu pedido todavía (${body.motivo!.trim()}). Nos pondremos en contacto contigo.`;
    await enviarPushDirecto(chatLead.push_token, "DrNatury", mensaje);
  }

  return NextResponse.json({ id, estado: body.estado });
}

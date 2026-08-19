import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushNotification } from "@/lib/push/send";
import type { TemplateKey } from "@/lib/whatsapp/templates";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Traer todos los items con su producto y sucursal
  const { data: items, error } = await admin
    .from("inventory_items")
    .select(`
      id,
      quantity,
      products(name, min_weekly_quantity),
      branches(name)
    `);

  if (error) {
    console.error("[CRON low-stock] Error:", error.message);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  // Obtener el Master
  const { data: masterProfile } = await admin
    .from("profiles")
    .select("id")
    .contains("roles", ["MASTER"])
    .single();

  if (!masterProfile?.id) {
    return NextResponse.json({ error: "NO_MASTER" }, { status: 500 });
  }

  let sent = 0;

  for (const item of items ?? []) {
    const product = Array.isArray(item.products) ? item.products[0] : item.products as { name: string; min_weekly_quantity: number } | null;
    const branch  = Array.isArray(item.branches)  ? item.branches[0]  : item.branches  as { name: string } | null;

    if (!product?.min_weekly_quantity) continue;
    if (item.quantity >= product.min_weekly_quantity) continue;

    const result = await sendPushNotification(masterProfile.id, "low_stock_alert" as TemplateKey, {
      product_name: product.name ?? "",
      branch_name:  branch?.name ?? "",
      quantity:     String(item.quantity),
      min_quantity: String(product.min_weekly_quantity),
    });

    if (result.sent) sent++;
  }

  console.log(`[CRON low-stock] Alertas enviadas: ${sent}`);
  return NextResponse.json({ sent });
}
import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

// Tipos posibles que devuelve el servicio WAWEB
export type QRStatus =
  | "LOADING"       // iniciando sesión
  | "QR"            // QR listo para escanear
  | "CONNECTED"     // sesión activa
  | "DISCONNECTED"  // sesión cerrada / expirada
  | "RECONNECTING"  // reconexión automática en progreso
  | "AUTH_FAILURE"  // QR escaneado pero autenticación fallida
  | "NO_SERVICE"    // WHATSAPP_SERVICE_URL no configurada
  | "ERROR";        // error de red u otro

export interface QRResponse {
  status: QRStatus;
  qr?: string;    // data:image/png;base64,... presente cuando status === "QR"
  error?: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: number } = await admin
    .from("whatsapp_numbers")
    .select("phone")
    .eq("id", id)
    .maybeSingle();

  if (!number) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const serviceUrl = process.env.WHATSAPP_SERVICE_URL;
  if (!serviceUrl) {
    return NextResponse.json({ status: "NO_SERVICE" } satisfies QRResponse);
  }

  try {
    const res = await fetch(
      `${serviceUrl}/api/qr?phone=${encodeURIComponent(number.phone)}`,
      { signal: AbortSignal.timeout(8_000) }
    );

    if (!res.ok) {
      return NextResponse.json({
        status: "ERROR",
        error: `Servicio respondió ${res.status}`,
      } satisfies QRResponse);
    }

    const data = await res.json() as QRResponse;
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      status: "ERROR",
      error: msg.includes("abort") ? "El servicio tardó demasiado" : "Servicio no disponible",
    } satisfies QRResponse);
  }
}

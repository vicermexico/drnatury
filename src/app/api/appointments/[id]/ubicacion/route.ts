import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyConfirmToken } from "@/lib/appointments/tokens";
import { checkRateLimit } from "@/lib/rate-limit";

// El paciente (sin login, con el link que le mando Vic por WhatsApp)
// comparte su ubicacion actual desde su celular -- se guarda en la cita
// a domicilio para que Vic vea el mapa exacto en vez de solo la
// direccion escrita a mano.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    if (!checkRateLimit(`ubicacion:${ip}`, 20, 60_000)) {
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
    const { data: appt } = await admin
      .from("appointments")
      .select("id, modalidad")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!appt) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (appt.modalidad !== "DOMICILIO") {
      return NextResponse.json({ error: "NOT_DOMICILIO", message: "Esta cita no es a domicilio" }, { status: 400 });
    }

    const { error: updateError } = await admin
      .from("appointments")
      .update({ domicilio_lat: lat, domicilio_lng: lng })
      .eq("id", id);

    if (updateError) return NextResponse.json({ error: "DB_ERROR", message: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error en PATCH /api/appointments/[id]/ubicacion:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

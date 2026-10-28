import { type NextRequest, NextResponse } from "next/server";
import { verifyQuickSecret } from "@/lib/quick-link/secret";
import { buildIcsEvent, icsResponseHeaders } from "@/lib/calendar/ics";

// Genera el .ics para el boton "Agregar a mi calendario" del link rapido
// de Master (sin sesion). Igual que /api/appointments/[id]/ics pero sin
// requerir login — toda la info que necesita viene en la URL (el
// navegador de Master ya la tiene a mano justo despues de agendar o
// bloquear, no hace falta volver a consultar la base de datos).

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (!verifyQuickSecret(secret)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const uid = searchParams.get("uid");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const summary = searchParams.get("summary");
  if (!uid || !start || !end || !summary) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const ics = buildIcsEvent({
    uid: `${uid}@drnatury.com`,
    startsAtISO: start,
    endsAtISO: end,
    summary,
    description: searchParams.get("description") ?? undefined,
    location: searchParams.get("location") ?? undefined,
    alarmMinutesBefore: 60,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: icsResponseHeaders("drnatury.ics"),
  });
}

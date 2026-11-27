import { NextResponse } from "next/server";
import { guardRole } from "@/lib/auth/api-guard";
import { getDomicilioExtraMinutes, setDomicilioExtraMinutes } from "@/lib/appointments/domicilioConfig";

export async function GET() {
  const extra_minutes = await getDomicilioExtraMinutes();
  return NextResponse.json({ extra_minutes });
}

export async function PATCH(request: Request) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as { extra_minutes?: number };
  const minutos = Number(body.extra_minutes);
  if (!Number.isFinite(minutos) || minutos < 0 || minutos > 600) {
    return NextResponse.json({ message: "Minutos invalidos" }, { status: 400 });
  }
  await setDomicilioExtraMinutes(Math.round(minutos));
  return NextResponse.json({ ok: true, extra_minutes: Math.round(minutos) });
}

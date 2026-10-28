import { NextResponse } from "next/server";
import { guardRole } from "@/lib/auth/api-guard";
import { disconnectGoogleCalendar } from "@/lib/calendar/google-auth";

export async function POST() {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  await disconnectGoogleCalendar();
  return NextResponse.json({ ok: true });
}

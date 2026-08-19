import { NextResponse } from "next/server";
import { guardRole } from "@/lib/auth/api-guard";

export interface LiveStatusEntry {
  phone:  string;
  status: string;
}

export async function GET() {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const serviceUrl = process.env.WHATSAPP_SERVICE_URL;
  if (!serviceUrl) return NextResponse.json([] satisfies LiveStatusEntry[]);

  try {
    const res = await fetch(`${serviceUrl}/api/status`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return NextResponse.json([] satisfies LiveStatusEntry[]);
    const data = await res.json() as LiveStatusEntry[];
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([] satisfies LiveStatusEntry[]);
  }
}

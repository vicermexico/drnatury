import { NextRequest, NextResponse } from "next/server";
import { guardRole } from "@/lib/auth/api-guard";
import { buildGoogleAuthUrl } from "@/lib/calendar/google-auth";
import { randomBytes } from "crypto";

// Master toca "Conectar Google Calendar" en /master/calendario -> lo
// manda para aca -> lo redirigimos a la pantalla de permisos de Google.
// El "state" evita que alguien mas complete la conexion con un link
// armado a mano (se verifica en el callback contra esta misma cookie).

export async function GET(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const state = randomBytes(16).toString("hex");
  const url = buildGoogleAuthUrl(state);

  const res = NextResponse.redirect(url);
  res.cookies.set("gcal_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}

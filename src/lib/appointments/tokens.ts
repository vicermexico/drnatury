import "server-only";
import { createHmac } from "crypto";

// Genera un token HMAC-SHA256 para el link de Confirmar/Cancelar
// que va en el mensaje de WhatsApp (PRD §18).
// El token es único por cita — no se puede usar para otra.
export function generateConfirmToken(appointmentId: string): string {
  const secret = process.env.APPOINTMENT_TOKEN_SECRET;
  if (!secret) throw new Error("APPOINTMENT_TOKEN_SECRET not set");
  return createHmac("sha256", secret)
    .update(appointmentId)
    .digest("hex")
    .slice(0, 32);
}

export function verifyConfirmToken(appointmentId: string, token: string): boolean {
  try {
    const expected = generateConfirmToken(appointmentId);
    // Comparación de longitud constante para evitar timing attacks
    if (expected.length !== token.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export function buildConfirmUrl(appointmentId: string, baseUrl: string): string {
  const token = generateConfirmToken(appointmentId);
  return `${baseUrl}/cita/${appointmentId}?token=${token}`;
}

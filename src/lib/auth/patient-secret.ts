import "server-only";
import { createHmac } from "crypto";

// Deriva una contraseña determinista para pacientes.
// Pacientes nunca ven ni ingresan contraseña (PRD §6).
// El secreto está en PATIENT_SIGNING_SECRET — si cambia, invalida
// todas las sesiones de pacientes (útil ante una brecha).
export function derivePatientPassword(phone: string): string {
  const secret = process.env.PATIENT_SIGNING_SECRET;
  if (!secret) throw new Error("PATIENT_SIGNING_SECRET not set");
  return createHmac("sha256", secret).update(phone).digest("hex");
}

// Alias de email interno para auth — los pacientes no necesitan saberlo.
export function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@drb.mx`;
}

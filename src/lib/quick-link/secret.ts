import "server-only";

// El link rapido de Master ("sin login") se protege con un codigo secreto
// larguisimo guardado en la variable de entorno MASTER_QUICK_LINK_SECRET,
// en vez de una pantalla de usuario/contraseña. Mismo espiritu que el
// link de confirmar/cancelar que le llega al paciente por WhatsApp
// (ver src/lib/appointments/tokens.ts), solo que aqui el codigo es fijo
// (no cambia por cita) porque es un link personal de Master, no uno por
// cita.

export function verifyQuickSecret(secret: string | null | undefined): boolean {
  const expected = process.env.MASTER_QUICK_LINK_SECRET;
  if (!expected || !secret) return false;
  if (expected.length !== secret.length) return false;
  // Comparacion de longitud constante para evitar timing attacks
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diff === 0;
}

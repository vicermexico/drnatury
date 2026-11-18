// Utilidades de enlaces de la portada (replica simplificada de appvlc).
// Puras (sin servidor): las usan los componentes para armar los enlaces publicos.

// Solo http/https. Si falta el esquema se asume https. Devuelve la URL normalizada o null.
export function enlaceSeguro(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  if (!texto || texto.length > 300) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

// WhatsApp de Mexico: 10 digitos. Acepta formatos como "55 1234 5678", "+52 55 1234 5678"
// o "52 1 55 1234 5678". Devuelve los 10 digitos o null si no cuadra.
export function normalizarWhatsapp(valor: unknown): string | null {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (digitos.length === 10) return digitos;
  if (digitos.length === 12 && digitos.startsWith("52")) return digitos.slice(2);
  if (digitos.length === 13 && digitos.startsWith("521")) return digitos.slice(3);
  return null;
}

export function enlaceWhatsapp(numero10: string | null | undefined, mensaje?: string): string | null {
  const n = numero10 ? normalizarWhatsapp(numero10) : null;
  if (!n) return null;
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : "";
  return `https://wa.me/52${n}${texto}`;
}

// "55 1234 5678" para mostrar un numero de 10 digitos
export function formatoTelefono10(numero10: string): string {
  const n = numero10.replace(/\D/g, "");
  return n.length === 10 ? `${n.slice(0, 2)} ${n.slice(2, 6)} ${n.slice(6)}` : numero10;
}

export function correoValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor) && valor.length <= 120;
}

export function enlaceCorreo(valor: string | null | undefined): string | null {
  return valor && correoValido(valor) ? `mailto:${valor}` : null;
}

export function enlaceMapa(direccion: string | null | undefined): string | null {
  if (!direccion?.trim()) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion.trim())}`;
}

// Para mostrar el sitio web sin "https://" ni "/" final
export function sitioCorto(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

// Rate limiter en memoria — solo para desarrollo/staging.
// En producción reemplazar con Upstash Redis o similar.

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count++;
  return true;
}

// Circular rotation across up to 4 registered WhatsApp numbers.
// If a number is marked as banned/down it is skipped automatically.

export interface WhatsAppNumber {
  id: string;
  phone: string;
  is_active: boolean;
}

export function getNextNumber(
  numbers: WhatsAppNumber[],
  lastUsedIndex: number
): { number: WhatsAppNumber; nextIndex: number } | null {
  const active = numbers.filter((n) => n.is_active);
  if (active.length === 0) return null;

  const nextIndex = (lastUsedIndex + 1) % active.length;
  return { number: active[nextIndex], nextIndex };
}

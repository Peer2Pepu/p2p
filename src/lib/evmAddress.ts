/** Canonical zero address (lowercase). */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

/** Normalize a contract address string for comparisons / map keys. */
export function safeAddressLower(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const t = value.trim();
  if (!t.startsWith('0x')) return undefined;
  const lower = t.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(lower)) return undefined;
  return lower;
}

/**
 * `getMarket` for an unused market id returns a struct with zero creator.
 * Tuple-style reads may expose creator at index 0.
 */
export function isEmptyOnChainMarketSlot(market: unknown): boolean {
  if (market == null) return true;
  const m = market as Record<string | number, unknown>;
  const creator = safeAddressLower(m.creator ?? m[0]);
  return !creator || creator === ZERO_ADDRESS;
}

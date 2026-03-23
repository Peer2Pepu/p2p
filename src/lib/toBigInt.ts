/** Coerce wagmi / JSON / loose values to bigint for on-chain uint fields. */
export function toBigIntSafe(value: unknown): bigint {
  if (value == null) return BigInt(0);
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === 'string' && value.trim() !== '') {
    try {
      return BigInt(value.trim());
    } catch {
      return BigInt(0);
    }
  }
  return BigInt(0);
}

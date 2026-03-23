import type { UserAnalytics } from '@/types/profile';
import { toBigIntSafe } from '@/lib/toBigInt';

/** ABI order for getUserStats (MetricsHub / analytics). */
const KEYS: (keyof UserAnalytics)[] = [
  'totalStakesPlaced',
  'totalStakesWon',
  'totalStakesLost',
  'totalWinnings',
  'totalLosses',
  'totalSupportDonated',
  'marketsCreated',
  'marketsWon',
  'marketsLost',
  'favoriteOption',
  'lastActivity',
  'totalStakesWonNative',
  'totalStakesWonP2PToken',
  'totalWinningsNative',
  'totalWinningsP2PToken',
];

/**
 * Wagmi/viem often returns struct reads as a readonly tuple, not a named object.
 * Normalize to UserAnalytics so UI can use field names safely.
 */
export function normalizeUserStatsContract(raw: unknown): UserAnalytics | null {
  if (raw == null) return null;

  if (Array.isArray(raw)) {
    const out = {} as UserAnalytics;
    for (let i = 0; i < KEYS.length; i++) {
      out[KEYS[i]] = toBigIntSafe(raw[i]);
    }
    return out;
  }

  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const out = {} as UserAnalytics;
    for (let i = 0; i < KEYS.length; i++) {
      const key = KEYS[i];
      const named = o[key as string];
      const byIndex = o[String(i)];
      out[key] = toBigIntSafe(named !== undefined ? named : byIndex);
    }
    return out;
  }

  return null;
}

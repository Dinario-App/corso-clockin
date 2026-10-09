import type { RiskFlag } from '@/src/features/tokenFacts/types';

/** Marker constant for static review — flags are display data only. */
export const TOKEN_FACTS_FLAGS_ARE_DISCLOSURE_ONLY = true as const;

/**
 * Returns flags for UI copy only. Callers must not use the return value to
 * refuse, hide, or delay a user-initiated action.
 */
export function disclosureFlags(flags: RiskFlag[]): RiskFlag[] {
  return flags;
}

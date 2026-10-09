import type { CredentialProvider } from '@/src/features/aiConnect/types';

export type ConsentScopedClear =
  | Readonly<{ kind: 'all' }>
  | Readonly<{ kind: 'connected'; provider: CredentialProvider }>;

const ALL_CONSENT_SCOPED_STATE = Object.freeze({ kind: 'all' } as const);
const clears = new Set<(scope: ConsentScopedClear) => void>();

/**
 * Register state that must go whenever consent is cleared. Returns the
 * unregister, for symmetry; product code registers once, at module load.
 */
export function registerConsentScopedClear(
  clear: (scope: ConsentScopedClear) => void,
): () => void {
  clears.add(clear);
  return () => {
    clears.delete(clear);
  };
}

/**
 * @internal Called by `aiConsentStore.ts` only: sign-out, "Delete everything",
 * and every change of wallet. A clear that throws must not stop the others, and
 * must not stop the disk clear behind it.
 */
export function clearConsentScopedState(
  scope: ConsentScopedClear = ALL_CONSENT_SCOPED_STATE,
): void {
  for (const clear of clears) {
    try {
      clear(scope);
    } catch {
      // A clear that cannot run is not a reason to keep the rest of the text.
    }
  }
}

import type { CredentialProvider } from '@/src/features/aiConnect/types';
import { registerConsentScopedClear } from './consentScopedClear';

export type ConsentRequestOrigin = 'home' | 'your_ai' | 'intro';

export type ConsentRequest =
  | Readonly<{ id: string; kind: 'default_assistant'; origin: ConsentRequestOrigin }>
  | Readonly<{
      id: string;
      kind: 'connected';
      provider: CredentialProvider;
      brainId?: string;
      origin: ConsentRequestOrigin;
    }>;

export type ConsentResolution = 'allowed' | 'declined' | 'dismissed';

let queue: readonly ConsentRequest[] = Object.freeze([]);
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Same id, or the same sheet: one default request, or one per connected provider. */
function isDuplicate(a: ConsentRequest, b: ConsentRequest): boolean {
  if (a.id === b.id) return true;
  if (a.kind === 'default_assistant' || b.kind === 'default_assistant') return a.kind === b.kind;
  return a.provider === b.provider;
}

/**
 * Queue a request. A duplicate of one already pending is ignored, and the
 * pending one is returned so the caller resolves the request that will show.
 * An empty id is refused (`null`).
 */
export function raiseConsentRequest(request: ConsentRequest): ConsentRequest | null {
  if (request.id.length === 0) return null;
  const pending = queue.find((entry) => isDuplicate(entry, request));
  if (pending) return pending;
  const stored = Object.freeze({ ...request });
  queue = Object.freeze([...queue, stored]);
  emit();
  return stored;
}

/** The request to show now: the oldest pending one, or `null`. */
export function currentConsentRequest(): ConsentRequest | null {
  return queue[0] ?? null;
}

export function subscribeConsentRequests(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Removes the request. The resolution is the caller's to record; nothing is stored here. */
export function resolveConsentRequest(id: string, _resolution: ConsentResolution): void {
  const next = queue.filter((entry) => entry.id !== id);
  if (next.length === queue.length) return;
  queue = Object.freeze(next);
  emit();
}

/**
 * @internal Called by `aiConsentStore.ts` only: when it clears consent from the
 * phone, and on a change of wallet.
 */
export function dropAllConsentRequests(): void {
  if (queue.length === 0) return;
  queue = Object.freeze([]);
  emit();
}

/** The shared clear seam owns queued consent state, including a targeted forget. */
registerConsentScopedClear((scope) => {
  if (scope.kind === 'all') {
    dropAllConsentRequests();
    return;
  }
  const next = queue.filter(
    (entry) => entry.kind !== 'connected' || entry.provider !== scope.provider,
  );
  if (next.length === queue.length) return;
  queue = Object.freeze(next);
  emit();
});

export function __resetConsentRequestsForTests(): void {
  queue = Object.freeze([]);
  listeners.clear();
}

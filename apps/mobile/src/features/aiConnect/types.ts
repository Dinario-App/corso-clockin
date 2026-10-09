import type { ByoAiFlags } from './flags';

export const SUBSCRIPTION_PROVIDERS = ['chatgpt', 'claude', 'grok'] as const;
export type SubscriptionProvider = (typeof SUBSCRIPTION_PROVIDERS)[number];

export const BYOK_PROVIDERS = ['openai', 'anthropic', 'xai'] as const;
export type ByokProvider = (typeof BYOK_PROVIDERS)[number];

export type BrainProvider = SubscriptionProvider | ByokProvider | 'managed';

export const CREDENTIAL_PROVIDERS = [
  ...SUBSCRIPTION_PROVIDERS,
  ...BYOK_PROVIDERS,
] as const;
export type CredentialProvider = SubscriptionProvider | ByokProvider;

export function isSubscriptionProvider(
  value: unknown,
): value is SubscriptionProvider {
  return (SUBSCRIPTION_PROVIDERS as readonly unknown[]).includes(value);
}

export function isByokProvider(value: unknown): value is ByokProvider {
  return (BYOK_PROVIDERS as readonly unknown[]).includes(value);
}

export function isCredentialProvider(
  value: unknown,
): value is CredentialProvider {
  return isSubscriptionProvider(value) || isByokProvider(value);
}

export type AuthKind = 'oauth' | 'setupToken' | 'apiKey';

export type StoredCred = Readonly<{
  provider: CredentialProvider;
  accountId: string;
  authKind: AuthKind;
  accessToken: string;
  refreshToken: string | null;
  expiresAtMs: number;
  scopes: readonly string[];
  /** Display only. */
  planTier: string | null;
  /** "work" / "personal" for the account pool. */
  label: string | null;
  invalidatedAt: number | null;
  entitlementBlockedAt: number | null;
}>;

export type BrainFailureClass =
  | 'CLIENT_INVALIDATED'
  | 'RATE_LIMITED'
  | 'ENTITLEMENT_BLOCKED'
  | 'TRANSIENT';

export type UsageWindow = Readonly<{
  usedPercent: number;
  /** Epoch ms, or null when the provider gave none. */
  resetAtMs: number | null;
}>;

export type UsageSnapshot = Readonly<{
  session: UsageWindow | null;
  /** ~7d window. */
  weekly: UsageWindow | null;
  planTier: string | null;
  limitReached: boolean;
  readAtMs: number;
}>;

export type BrainStatus = 'ready' | 'needs_reconnect' | 'resting' | 'blocked';

export type BrainSummary = Readonly<{
  id: string;
  provider: BrainProvider;
  kind: 'subscription' | 'byok' | 'managed';
  accountId: string | null;
  label: string | null;
  planTier: string | null;
  status: BrainStatus;
  usage: UsageSnapshot | null;
}>;

/** What a connected model is given: the question plus symbols and rounded amounts, never mints or addresses. */
export type BrainContext = Readonly<{
  question: string;
  holdings: readonly Readonly<{ symbol: string; amount: string }>[];
  instructions: string;
}>;

export type ProposalDraft = Readonly<{
  kind: 'proposal';
  asset: string | null;
  side: 'buy' | 'sell' | 'hold' | null;
  sizeBand: 'small' | 'medium' | 'large' | null;
  rationale: string;
  /** 0..1, or null when the model gave none. */
  confidence: number | null;
}>;

export type ConsentScope = Readonly<{
  owner: string;
  takeId: string;
  stillCurrent: () => boolean;
}>;

export type AgentState =
  | Readonly<{
      status: 'proposal';
      draft: ProposalDraft;
      provider: BrainProvider;
      slotId: string;
      degraded: boolean;
    }>
  | Readonly<{
      status: 'paused';
      reason: 'all_brains_exhausted' | 'auto_execute_refused';
    }>;

/** The propose-only surface the Ask screen calls when a model is connected. Off in this build. */
export type AiConnect = {
  propose(
    context: BrainContext,
    flags: ByoAiFlags,
    signal?: AbortSignal,
    execution?: undefined,
    preferBrainId?: string | null,
    consent?: ConsentScope | null,
  ): Promise<AgentState>;
};

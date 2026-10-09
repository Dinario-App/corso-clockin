import type { SubscriptionProvider } from './types';

export type ByoAiFlags = Readonly<{
  byoAiEnabled: boolean;
  chatgptEnabled: boolean;
  claudeEnabled: boolean;
  grokEnabled: boolean;
}>;

export const BYO_AI_FLAGS_OFF: ByoAiFlags = Object.freeze({
  byoAiEnabled: false,
  chatgptEnabled: false,
  claudeEnabled: false,
  grokEnabled: false,
});

export function parseByoAiFlags(_flags: unknown): ByoAiFlags {
  return BYO_AI_FLAGS_OFF;
}

/** Whether a subscription connect path is live. BYOK and managed need no switch. */
export function isSubscriptionProviderEnabled(
  flags: ByoAiFlags,
  provider: SubscriptionProvider,
): boolean {
  if (!flags.byoAiEnabled) return false;
  switch (provider) {
    case 'chatgpt':
      return flags.chatgptEnabled;
    case 'claude':
      return flags.claudeEnabled;
    case 'grok':
      return flags.grokEnabled;
  }
}

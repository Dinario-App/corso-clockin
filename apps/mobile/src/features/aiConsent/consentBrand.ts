import type { CredentialProvider } from '@/src/features/aiConnect/types';

export type ConsentBrand = Readonly<{ brand: string; company: string }>;

export const CONSENT_BRANDS: Readonly<Partial<Record<CredentialProvider, ConsentBrand>>> =
  Object.freeze({
    chatgpt: Object.freeze({ brand: 'ChatGPT', company: 'OpenAI' }),
    grok: Object.freeze({ brand: 'Grok', company: 'xAI' }),
    openai: Object.freeze({ brand: 'OpenAI key', company: 'OpenAI' }),
    anthropic: Object.freeze({ brand: 'Claude key', company: 'Anthropic' }),
    xai: Object.freeze({ brand: 'xAI key', company: 'xAI' }),
  });

export function brandFor(provider: CredentialProvider): ConsentBrand | null {
  return Object.hasOwn(CONSENT_BRANDS, provider) ? (CONSENT_BRANDS[provider] ?? null) : null;
}

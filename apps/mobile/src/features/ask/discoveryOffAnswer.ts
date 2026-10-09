import { answerFromText } from './askClient';
import { trustedCopy } from './askText';
import { copy } from '@/constants/copy';
import type { AskAnswer } from '@/src/features/ask/askClient';
import { isMovingAsk } from '@/src/features/switcher/liveCards';

const DISCOVERY_ASK =
  /\b(trending|fresh pairs?|new pairs?|runners|graduating|graduated|bonding curve)\b/i;

/** A question about the discovery feed itself, not a Moving chip. */
export function isDiscoveryAsk(text: string): boolean {
  const question = text.normalize('NFKC').trim();
  if (!question) return false;
  if (isMovingAsk(question)) return false;
  return DISCOVERY_ASK.test(question);
}

/**
 * The calm flag-off answer, or `null` to let the sentence go to Ask unchanged.
 */
export function resolveDiscoveryOffAnswer(input: {
  text: string;
  discoveryEnabled: boolean;
}): AskAnswer | null {
  if (input.discoveryEnabled) return null;
  if (!isDiscoveryAsk(input.text)) return null;
  return answerFromText('answered', trustedCopy('ask', 'discoveryOff'));
}

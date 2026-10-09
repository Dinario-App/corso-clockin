import { joinTrustedCopy, type AskText, type TrustedCopy } from './askText';
import { readModelText } from './askAnswerBoundary';

/** Existing sell composition. An interpolated subject stays untrusted. */
export function formatSellIntentLine(
  question: AskText,
  limit: TrustedCopy | null,
): AskText {
  if (!limit) return question;
  return question.kind === 'trusted'
    ? joinTrustedCopy([question, limit])
    : readModelText(`${question.text} ${limit.text}`);
}

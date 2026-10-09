import type { AskAnswer } from '@/src/features/ask/askClient';
import {
  captureAiConsentOwner,
  grantSingleUseDefaultConsent,
  recordDefaultDecision,
  type AiConsentOwnerBinding,
  type AiConsentWriteResult,
  type DefaultAssistantDecision,
} from '@/src/features/aiConsent/aiConsentStore';
import type { ConsentResolution } from '@/src/features/aiConsent/consentRequests';

export type DefaultConsentRoute = 'land' | 'hold' | 'explain' | 'retry';

export function routeDefaultConsentAnswer(input: {
  answer: AskAnswer;
  overlaid: boolean;
  decision: 'unset' | DefaultAssistantDecision;
  /** This request is the one resend a consent decision allows. */
  consentRetry: boolean;
}): DefaultConsentRoute {
  if (input.overlaid || input.answer.consentRequired !== 'default_assistant') return 'land';
  // One resend per question. A second consent_required never loops the sheet.
  if (input.consentRetry) return 'explain';
  if (input.decision === 'allowed') return 'retry';
  return 'hold';
}

export type DefaultConsentWriter = {
  recordDefaultDecision: (decision: DefaultAssistantDecision) => Promise<AiConsentWriteResult>;
  grantSingleUseDefaultConsent: (requestId: string) => boolean;
  captureAiConsentOwner: () => AiConsentOwnerBinding | null;
};

const STORE_WRITER: DefaultConsentWriter = {
  recordDefaultDecision,
  grantSingleUseDefaultConsent,
  captureAiConsentOwner,
};

export async function applyDefaultConsentResolution(
  resolution: ConsentResolution,
  /** The held question's request id. The permission and the send share it. */
  requestId: string,
  writer: DefaultConsentWriter = STORE_WRITER,
): Promise<{ resend: boolean }> {
  if (resolution === 'dismissed') return { resend: false };
  if (resolution === 'declined') {
    await writer.recordDefaultDecision('declined');
    return { resend: false };
  }
  // The wallet that tapped Allow, captured before the write starts.
  const binding = writer.captureAiConsentOwner();
  if (binding === null) return { resend: false };
  const result = await writer.recordDefaultDecision('allowed');
  if (!binding.stillCurrent()) return { resend: false };
  if (result.persisted) return { resend: true };
  if (result.reason !== 'write_failed') return { resend: false };
  // The store checks the wallet, the generation and the revision again; a
  // refused grant is no permission, so nothing is resent.
  return { resend: writer.grantSingleUseDefaultConsent(requestId) };
}

export function shouldShowYourAiDoor(input: {
  focusedCardId: string | null;
  explainerCardId: string | null;
  decision: 'unset' | DefaultAssistantDecision;
}): boolean {
  return (
    input.explainerCardId !== null &&
    input.focusedCardId === input.explainerCardId &&
    input.decision === 'declined'
  );
}

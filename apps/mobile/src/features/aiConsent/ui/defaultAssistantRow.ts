import { copy } from '@/constants/copy';
import type {
  AiConsentWriteResult,
  DefaultAssistantDecision,
} from '@/src/features/aiConsent/aiConsentStore';

export type DefaultAssistantRow = Readonly<{
  label: string;
  sub: string;
  checked: boolean;
  accessibilityLabel: string;
}>;

/**
 * `unset` renders as off.
 *
 * ⛔ It is not a third visual state. A person who has never been asked and a
 * person who said no are both in the state where no question goes to Google,
 * and the switch says what is true of the wire, not what the store remembers.
 * Turning it on from `unset` records the same `allowed` the sheet records, so
 * the sheet never asks again afterwards.
 */
export function defaultAssistantRow(
  decision: 'unset' | DefaultAssistantDecision,
): DefaultAssistantRow {
  const checked = decision === 'allowed';
  return Object.freeze({
    label: copy.aiConsent.defaultTitle,
    sub: copy.aiConsent.defaultBody,
    checked,
    accessibilityLabel: `${copy.aiConsent.defaultTitle}. ${
      checked ? copy.aiConsent.defaultAllow : copy.aiConsent.defaultNotNow
    }`,
  });
}

/**
 * What a flick of the switch records.
 *
 * ⛔ Off is `declined`, not a cleared decision. Clearing would return the person
 * to `unset`, and the next model question would raise the sheet again — which
 * reads as the app ignoring the answer it was just given.
 */
export function decisionForSwitch(value: boolean): DefaultAssistantDecision {
  return value ? 'allowed' : 'declined';
}

/**
 * Whether the switch has to tell the person their withdrawal did not stick.
 *
 * ⛔ Only `revoke_unsafe`, never every failure. The store's disk ladder saves
 * the ordinary refused write by removing the record instead, and a warning that
 * fires when nothing is wrong teaches people to ignore it. This is the single
 * case where memory has stopped consenting and the phone still holds a grant
 * the next launch would read.
 */
export function revokeWarningNeeded(result: AiConsentWriteResult): boolean {
  return result.persisted === false && result.reason === 'revoke_unsafe';
}

import { copy } from '@/constants/copy';

export const PASSCODE_LENGTH = 6;

export type PasscodeStage = 'set' | 'confirm';

export type PasscodeEntry = {
  stage: PasscodeStage;
  /** Digits typed so far in the current stage. */
  draft: string;
  /** Committed first entry, only once stage is `confirm`. */
  first: string;
  /** Filled dot count for the current stage. */
  filled: number;
  error: string | null;
  /** True exactly once, on the keystroke that completes a matching confirm. */
  complete: boolean;
  title: string;
  body: string;
};

const DIGITS = '0123456789';

export function emptyPasscodeEntry(): PasscodeEntry {
  return decorate({
    stage: 'set',
    draft: '',
    first: '',
    error: null,
    complete: false,
  });
}

type Core = {
  stage: PasscodeStage;
  draft: string;
  first: string;
  error: string | null;
  complete: boolean;
};

function decorate(core: Core): PasscodeEntry {
  return {
    ...core,
    filled: core.draft.length,
    title:
      core.stage === 'confirm'
        ? copy.v1Onboarding.passcodeConfirmTitle
        : copy.v1Onboarding.passcodeSetTitle,
    body: core.stage === 'confirm' ? '' : copy.v1Onboarding.passcodeSetBody,
  };
}

function isDigit(value: unknown): value is string {
  return typeof value === 'string' && value.length === 1 && DIGITS.includes(value);
}

export function pressPasscodeDigit(
  state: PasscodeEntry,
  digit: unknown,
): PasscodeEntry {
  if (state.complete || !isDigit(digit) || state.draft.length >= PASSCODE_LENGTH) {
    return state;
  }
  const draft = state.draft + digit;
  if (draft.length < PASSCODE_LENGTH) {
    return decorate({ ...state, draft, error: null, complete: false });
  }
  if (state.stage === 'set') {
    return decorate({
      stage: 'confirm',
      draft: '',
      first: draft,
      error: null,
      complete: false,
    });
  }
  if (draft === state.first) {
    return decorate({
      stage: 'confirm',
      draft,
      first: state.first,
      error: null,
      complete: true,
    });
  }
  return decorate({
    stage: 'set',
    draft: '',
    first: '',
    error: copy.v1Onboarding.passcodeMismatch,
    complete: false,
  });
}

export function pressPasscodeDelete(state: PasscodeEntry): PasscodeEntry {
  if (state.complete || state.draft.length === 0) {
    return state;
  }
  return decorate({
    ...state,
    draft: state.draft.slice(0, -1),
    error: null,
    complete: false,
  });
}

/** The chosen passcode, available only on the keystroke that completed it. */
export function completedPasscode(state: PasscodeEntry): string | null {
  return state.complete ? state.draft : null;
}

import { copy } from '@/constants/copy';
import { resolveFaceIdPath } from '@/src/features/onboarding/faceIdStepPolicy';
import type { RevealStepUpMethod } from '@/src/features/security/revealStepUp';

export type SafeRevealDoor = 'import' | 'export';

/** Unknown or malformed session types fail closed to the import door. */
export function resolveSafeRevealDoor(sessionType: unknown): SafeRevealDoor {
  return resolveFaceIdPath(sessionType) === 'import' ? 'import' : 'export';
}

export type ImportDoorCeremony = {
  door: 'import';
  eyebrow: string;
  entryLabel: string;
  entryHint: string;
  warning: { title: string; lines: readonly string[]; cta: string };
  gate: { title: string; body: string; cta: string };
  reveal: { claim: string; captureChrome: string };
  hidden: { title: string; body: string; cta: string };
};

export type ExportDoorCeremony = {
  door: 'export';
  eyebrow: string;
  entryLabel: string;
  title: string;
  intro: string;
  stepLabel: string;
  step: string;
  warning: string;
  cta: string;
  cancel: string;
};

export type SafeRevealCeremony = ImportDoorCeremony | ExportDoorCeremony;

type CeremonyInput = {
  door: SafeRevealDoor;
  biometricLabel: string;
  /**
   * Which app-lock factor the step-up will ask for. Wording only: the gate
   * names the factor the device will actually raise. Defaults to biometric.
   */
  stepUpMethod?: RevealStepUpMethod;
};

export function resolveSafeRevealCeremony(
  input: CeremonyInput & { door: 'import' },
): ImportDoorCeremony;
export function resolveSafeRevealCeremony(
  input: CeremonyInput & { door: 'export' },
): ExportDoorCeremony;
export function resolveSafeRevealCeremony(input: CeremonyInput): SafeRevealCeremony;
export function resolveSafeRevealCeremony(input: CeremonyInput): SafeRevealCeremony {
  const c = copy.v1Security.safeReveal;
  if (input.door === 'import') {
    const d = c.importDoor;
    const passcode = input.stepUpMethod === 'passcode';
    return {
      door: 'import',
      eyebrow: d.eyebrow,
      entryLabel: d.entryLabel,
      entryHint: d.entryHint(input.biometricLabel),
      warning: {
        title: d.warningTitle,
        lines: d.warningLines,
        cta: d.warningCta,
      },
      gate: {
        title: d.gateTitle,
        body: passcode ? d.gateBodyPasscode : d.gateBody(input.biometricLabel),
        cta: passcode ? d.gateCtaPasscode : d.gateCta(input.biometricLabel),
      },
      reveal: { claim: d.claim, captureChrome: d.captureChrome },
      hidden: {
        title: d.hiddenTitle,
        body: d.hiddenBody,
        cta: copy.v1Security.showAgain,
      },
    };
  }
  const d = c.exportDoor;
  return {
    door: 'export',
    eyebrow: d.eyebrow,
    entryLabel: d.entryLabel,
    title: d.title,
    intro: d.intro,
    stepLabel: d.stepLabel,
    step: d.step,
    warning: d.warning,
    cta: d.cta,
    cancel: copy.v1.cancel,
  };
}

/** Every user-visible string a ceremony draws, flattened for invariants. */
export function visibleSafeRevealStrings(
  ceremony: SafeRevealCeremony,
): string[] {
  if (ceremony.door === 'import') {
    return [
      ceremony.eyebrow,
      ceremony.entryLabel,
      ceremony.entryHint,
      ceremony.warning.title,
      ...ceremony.warning.lines,
      ceremony.warning.cta,
      ceremony.gate.title,
      ceremony.gate.body,
      ceremony.gate.cta,
      ceremony.reveal.claim,
      ceremony.reveal.captureChrome,
      ceremony.hidden.title,
      ceremony.hidden.body,
      ceremony.hidden.cta,
    ];
  }
  return [
    ceremony.eyebrow,
    ceremony.entryLabel,
    ceremony.title,
    ceremony.intro,
    ceremony.stepLabel,
    ceremony.step,
    ceremony.warning,
    ceremony.cta,
    ceremony.cancel,
  ];
}

/** The Import-door custody claim, reserved for the door where it is true. */
export const DEVICE_CUSTODY_CLAIM_FRAGMENT = 'never leave this device';

/** Vendor and internals that must never surface in ceremony copy. */
export const SAFE_REVEAL_BANNED_WORDS = [
  'Privy',
  'Helius',
  'Jupiter',
  'mnemonic',
  'session',
] as const;

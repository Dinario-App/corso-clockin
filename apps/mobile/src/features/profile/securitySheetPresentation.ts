import { copy } from '@/constants/copy';
import { resolveDeleteEntryPresentation } from '@/src/features/account/deleteEntryPresentation';
import { resolveFaceIdPath, type FaceIdPath } from '@/src/features/onboarding/faceIdStepPolicy';
import { resolveSafeRevealCeremony } from '@/src/features/security/safeRevealPresentation';

export const SECURITY_SHEET_WORDS_HREF = '/profile/words';
export const SECURITY_SHEET_KEYS_HREF = '/profile/keys';
export const SECURITY_SHEET_DELETE_HREF = '/profile/delete';

export type SecuritySheetHref =
  | typeof SECURITY_SHEET_WORDS_HREF
  | typeof SECURITY_SHEET_KEYS_HREF
  | typeof SECURITY_SHEET_DELETE_HREF;

export type SecuritySheetRowId =
  | 'biometrics'
  | 'change-passcode'
  | 'your-words'
  | 'your-keys'
  | 'delete-everything';

export type SecuritySheetRow = {
  id: SecuritySheetRowId;
  label: string;
  accessory: 'value' | 'chevron' | 'none';
  value: string | null;
  href: SecuritySheetHref | null;
  tone: 'default' | 'destructive';
  /** Small caps line above the row — the reveal row's door label only. */
  eyebrow: string | null;
  /** Muted line under the label — e.g. `Face ID required`. Reveal row only. */
  hint: string | null;
};

export type SecuritySheetPresentation = {
  title: string;
  path: FaceIdPath;
  rows: SecuritySheetRow[];
  /** Footnote under the reveal row explaining why the two doors differ. */
  annotation: string;
};

export function resolveSecuritySheetPresentation(input: {
  sessionType: unknown;
  biometricLabel: string;
  biometricsOn: unknown;
  hasCorsoServerAccount?: boolean | null;
  hasImportedWalletOnPhone?: boolean;
  hasConnectedWalletOnPhone?: boolean;
}): SecuritySheetPresentation {
  const path = resolveFaceIdPath(input.sessionType);
  const deleteEntry = resolveDeleteEntryPresentation({
    hasCorsoServerAccount:
      input.hasCorsoServerAccount === undefined
        ? false
        : input.hasCorsoServerAccount,
    hasImportedWalletOnPhone:
      input.hasImportedWalletOnPhone ?? path === 'import',
    hasConnectedWalletOnPhone:
      input.hasConnectedWalletOnPhone ?? path === 'sign-in',
  });
  const ceremony = resolveSafeRevealCeremony({
    door: path === 'import' ? 'import' : 'export',
    biometricLabel: input.biometricLabel,
  });
  const revealRow: SecuritySheetRow =
    ceremony.door === 'import'
      ? {
          id: 'your-words',
          label: ceremony.entryLabel,
          accessory: 'chevron',
          value: null,
          href: SECURITY_SHEET_WORDS_HREF,
          tone: 'default',
          eyebrow: ceremony.eyebrow,
          hint: ceremony.entryHint,
        }
      : {
          id: 'your-keys',
          label: ceremony.entryLabel,
          accessory: 'chevron',
          value: null,
          href: SECURITY_SHEET_KEYS_HREF,
          tone: 'default',
          eyebrow: ceremony.eyebrow,
          hint: null,
        };

  return {
    title: copy.v1Security.title,
    path,
    rows: [
      {
        id: 'biometrics',
        label: input.biometricLabel,
        accessory: 'value',
        value:
          input.biometricsOn === true ? copy.v1Security.on : copy.v1Security.off,
        href: null,
        tone: 'default',
        eyebrow: null,
        hint: null,
      },
      {
        id: 'change-passcode',
        label: copy.v1Security.changePasscode,
        accessory: 'chevron',
        value: null,
        href: null,
        tone: 'default',
        eyebrow: null,
        hint: null,
      },
      revealRow,
      {
        id: 'delete-everything',
        label: deleteEntry.label,
        accessory: 'none',
        value: null,
        href: SECURITY_SHEET_DELETE_HREF,
        tone: 'destructive',
        eyebrow: null,
        hint: null,
      },
    ],
    annotation: copy.v1Security.safeReveal.annotation,
  };
}

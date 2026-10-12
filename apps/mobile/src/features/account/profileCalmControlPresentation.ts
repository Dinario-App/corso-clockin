import { copy } from '@/constants/copy';
import type {
  AccountRootCard,
  AccountRootRow,
} from './accountRootPresentation';
import { feeBpsToPercentLabel } from '@/src/features/swap/tokens';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames';

export const PROFILE_NOTIFICATIONS_HREF = '/profile/notifications';
export const PROFILE_HOW_IT_WORKS_HREF = '/profile/how-it-works';
export const PROFILE_ABOUT_HREF = '/profile/about';

/** Two initials from the portfolio name: "My money" → "MM". */
export function resolveProfileInitials(
  name: string | null | undefined,
): string | null {
  if (typeof name !== 'string') return null;
  const letters = name
    .trim()
    .split(/\s+/)
    .map((word) => Array.from(word)[0] ?? '')
    .filter((letter) => /\p{L}|\p{N}/u.test(letter))
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return letters.length > 0 ? letters : null;
}

/**
 * Wait alerts tray. `armed` is `pushArmed(readPushFlags())`; `null` means the
 * config read has not answered yet. `savedOnPhone` counts the alerts this
 * phone saved for this wallet (`readAlertPresets`); `null` means unread.
 */
export type ProfileWaitAlertsRow =
  | { kind: 'loading' }
  | { kind: 'empty'; title: string; body: string | null }
  | { kind: 'door'; label: string; href: string };

export function resolveProfileWaitAlerts(input: {
  armed: boolean | null;
  savedOnPhone: number | null;
}): ProfileWaitAlertsRow {
  if (input.armed === null) return { kind: 'loading' };
  if (input.armed === false) {
    return {
      kind: 'empty',
      title: copy.account.waitAlertsEmptyTitle,
      body: null,
    };
  }
  if (input.savedOnPhone === null) return { kind: 'loading' };
  if (input.savedOnPhone > 0) {
    return {
      kind: 'door',
      label: copy.profile.notificationsTitle,
      href: PROFILE_NOTIFICATIONS_HREF,
    };
  }
  return {
    kind: 'empty',
    title: copy.account.waitAlertsEmptyTitle,
    body: copy.account.waitAlertsEmptyBody,
  };
}

export async function readWaitAlertsArmed<F>(
  read: () => Promise<F>,
  isArmed: (flags: F) => boolean,
): Promise<boolean | null> {
  let flags: F;
  try {
    flags = await read();
  } catch {
    return null;
  }
  return isArmed(flags);
}

export type ProfileStaticRow = {
  id: 'fee';
  label: string;
  sub: string;
  glyph: CorsoIconName;
};

/** "Corso fee · 0.5%" from the live fee, or no row. Same label the receipt draws. */
export function resolveProfileFeeRow(
  feeBps: number | null,
): ProfileStaticRow | null {
  if (
    typeof feeBps !== 'number' ||
    !Number.isInteger(feeBps) ||
    feeBps < 0 ||
    feeBps > 10_000
  ) {
    return null;
  }
  return {
    id: 'fee',
    label: `${copy.swap.corsoFee} · ${feeBpsToPercentLabel(feeBps)}`,
    sub: copy.account.feeSub,
    glyph: 'copy',
  };
}

export type ProfileDoorRow = {
  id: 'how-it-works' | 'contact-support' | 'settings' | 'about';
  label: string;
  sub?: string;
  glyph: CorsoIconName;
  action: { kind: 'push'; href: string } | { kind: 'contact-support' };
};

/** Help: the same two rows Settings carries, same words and glyphs. */
export function resolveProfileHelpRows(): ProfileDoorRow[] {
  return [
    {
      id: 'how-it-works',
      label: copy.howItWorks.title,
      glyph: 'help',
      action: { kind: 'push', href: PROFILE_HOW_IT_WORKS_HREF },
    },
    {
      id: 'contact-support',
      label: copy.support.contactTitle,
      sub: copy.support.contactSub,
      glyph: 'mail',
      action: { kind: 'contact-support' },
    },
  ];
}

export type ProfileCalmLayout = {
  /** Security, then Sign out: the shipped rows, untouched. */
  security: AccountRootRow[];
  /** The shipped Settings row, moved under the fee as the target draws it. */
  settings: AccountRootRow | null;
  about: ProfileDoorRow;
  rest: AccountRootCard[];
};

export function resolveProfileCalmLayout(
  cards: AccountRootCard[],
): ProfileCalmLayout {
  const manage = cards.find((card) => card.id === 'manage');
  const rows = manage?.rows ?? [];
  return {
    security: rows.filter(
      (row) => row.id === 'security' || row.id === 'sign-out',
    ),
    settings: rows.find((row) => row.id === 'settings') ?? null,
    about: {
      id: 'about',
      label: copy.profile.aboutSection,
      glyph: 'more',
      action: { kind: 'push', href: PROFILE_ABOUT_HREF },
    },
    rest: cards.filter((card) => card.id !== 'manage'),
  };
}

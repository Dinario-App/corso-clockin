import { copy } from '@/constants/copy';
import { resolveSafeRevealDoor } from '@/src/features/security/safeRevealPresentation';
import { isDestructiveSignOut } from '@/src/features/session/signOutSheetPresentation';
import type {
  FiatTotalStatus,
  HoldingsSnapshot,
} from '@/src/features/balances/computeFiatTotal';
import { resolveHomeStaleMarker } from '@/src/features/home/asOfPresentation';
import {
  resolveHomeHeadline,
  type HomeBalancePhase,
} from '@/src/features/home/homeEmptyPresentation';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames.js';
import { colors } from '@/src/ui/tokens';

export const ACCOUNT_RECEIVE_HREF = '/receive';
export const ACCOUNT_SWAP_HREF = '/swap';
export const ACCOUNT_SECURITY_HREF = '/profile/security';
export const ACCOUNT_SETTINGS_HREF = '/profile/settings';
export const ACCOUNT_SEND_HREF = '/send';
export const HOME_SEND_PARAM = 'send';
export const ACCOUNT_BOTS_HREF = '/bots';
export const ACCOUNT_PAPER_HREF = '/paper';
export const ACCOUNT_DESK_HREF = '/desk-utilities';

export type AccountRowId =
  | 'buy'
  | 'send'
  | 'receive'
  | 'swap'
  | 'desk-utilities'
  | 'bots'
  | 'paper'
  | 'ai'
  | 'security'
  | 'settings'
  | 'sign-out';

export type AccountRowAction =
  | { kind: 'push'; href: string }
  | { kind: 'home-send' }
  | { kind: 'buy' }
  | { kind: 'sign-out' };

export type AccountRootRow = {
  id: AccountRowId;
  label: string;
  sub?: string;
  glyph: CorsoIconName;
  /** Chevron for a door; `none` for a row that opens a sheet in place. */
  accessory: 'chevron' | 'none';
  action: AccountRowAction;
};

export type AccountRootCard = {
  id: 'money' | 'automation' | 'ai' | 'manage';
  heading: string;
  rows: AccountRootRow[];
};

export function resolveAccountRootCards(input: {
  sendEnabled: unknown;
  botsEnabled?: unknown;
  buyEnabled?: unknown;
  sessionType?: unknown;
  grokbotRoutesEnabled?: boolean;
  deskV1?: unknown;
}): AccountRootCard[] {
  const grokbotRoutesOpen = input.grokbotRoutesEnabled !== false;
  const money: AccountRootRow[] = [];
  /**
   * Money in comes before money out, and it comes first because this row is the
   * one door a person with an empty wallet needs. Gated on `flags.rampEnabled`,
   * the same master switch `/buy` itself reads, so the row cannot outlive the
   * screen it opens.
   */
  if (input.buyEnabled === true) {
    money.push({
      id: 'buy',
      label: copy.buy.title,
      sub: copy.account.buySub,
      glyph: 'plus',
      accessory: 'chevron',
      action: { kind: 'buy' },
    });
  }
  if (input.sendEnabled === true && grokbotRoutesOpen) {
    money.push({
      id: 'send',
      label: copy.v1.send,
      sub: copy.account.sendSub,
      glyph: 'send',
      accessory: 'chevron',
      action: { kind: 'home-send' },
    });
  }
  money.push(
    {
      id: 'receive',
      label: copy.v1.receive,
      sub: copy.account.receiveSub,
      glyph: 'request',
      accessory: 'chevron',
      action: { kind: 'push', href: ACCOUNT_RECEIVE_HREF },
    },
    {
      id: 'swap',
      label: copy.account.swap,
      sub: copy.account.swapSub,
      glyph: 'swap',
      accessory: 'chevron',
      action: { kind: 'push', href: ACCOUNT_SWAP_HREF },
    },
  );
  if (input.deskV1 === true) {
    money.push({
      id: 'desk-utilities',
      label: copy.deskUtilities.title,
      glyph: 'grid',
      accessory: 'chevron',
      action: { kind: 'push', href: ACCOUNT_DESK_HREF },
    });
  }

  const cards: AccountRootCard[] = [
    { id: 'money', heading: copy.account.sectionMoney, rows: money },
  ];

  const automation: AccountRootRow[] = [];
  if (grokbotRoutesOpen && input.botsEnabled === true) {
    automation.push({
      id: 'bots',
      label: copy.account.botsRow,
      sub: copy.account.botsRowSub,
      /** A bot is a rule that runs. `rule` is the locked registry key. */
      glyph: 'rule',
      accessory: 'chevron',
      action: { kind: 'push', href: ACCOUNT_BOTS_HREF },
    });
  }
  if (grokbotRoutesOpen) {
    automation.push({
      id: 'paper',
      label: copy.account.paperRow,
      sub: copy.account.paperRowSub,
      glyph: 'rule',
      accessory: 'chevron',
      action: { kind: 'push', href: ACCOUNT_PAPER_HREF },
    });
  }
  if (automation.length > 0) {
    cards.push({
      id: 'automation',
      heading: copy.account.sectionAutomation,
      rows: automation,
    });
  }

  cards.push({
    id: 'manage',
    heading: copy.account.sectionSecurity,
    rows: [
      {
        id: 'security',
        label: copy.profile.securityTitle,
        sub:
          resolveSafeRevealDoor(input.sessionType) === 'import'
            ? copy.account.securitySub
            : copy.account.securitySubExport,
        glyph: 'lock',
        accessory: 'chevron',
        action: { kind: 'push', href: ACCOUNT_SECURITY_HREF },
      },
      {
        id: 'settings',
        label: copy.v1.settings,
        sub: copy.account.settingsSub,
        glyph: 'settings',
        accessory: 'chevron',
        action: { kind: 'push', href: ACCOUNT_SETTINGS_HREF },
      },
      {
        id: 'sign-out',
        label: copy.profile.signOut,
        sub: isDestructiveSignOut(input.sessionType)
          ? copy.account.signOutSubImport
          : copy.account.signOutSub,
        glyph: 'profile',
        accessory: 'none',
        action: { kind: 'sign-out' },
      },
    ],
  });

  return cards;
}

export function holdingsHaveFunds(
  holdings: HoldingsSnapshot | null | undefined,
): boolean {
  if (holdings?.quantityStatus !== 'ready') return false;
  return holdings.lines.some(
    (line) =>
      line.includeInHomeTotal &&
      /^\d+$/.test(line.atomic) &&
      BigInt(line.atomic) > 0n,
  );
}

export type AccountDeltaTone = 'up' | 'down' | 'flat';

export type AccountDelta = {
  text: string;
  tone: AccountDeltaTone;
  color: string;
};

export function resolveAccountDelta(
  changeFraction: number | null | undefined,
): AccountDelta | null {
  if (typeof changeFraction !== 'number' || !Number.isFinite(changeFraction)) {
    return null;
  }
  const percent = Math.abs(changeFraction * 100);
  const rounded =
    percent >= 100 ? Math.round(percent).toString() : percent.toFixed(1);
  if (changeFraction > 0) {
    return {
      text: copy.home.today(`+${rounded}%`),
      tone: 'up',
      color: colors.priceUp,
    };
  }
  if (changeFraction < 0) {
    return {
      text: copy.home.today(`−${rounded}%`),
      tone: 'down',
      color: colors.priceDown,
    };
  }
  return { text: copy.home.today('0.0%'), tone: 'flat', color: colors.muted };
}

export type AccountBalanceHead = {
  eyebrow: string;
  headline: string;
  /** Numeric amount for the count-up; null whenever the headline is not a read number. */
  countUpAmount: string | null;
  /** One quiet line under the number — today (real empty), stale marker, or nothing. */
  subline: string | null;
  unreadable: boolean;
  accessibilityLabel: string;
};

export function resolveAccountBalanceHead(input: {
  balancePhase: HomeBalancePhase;
  hasFunds: boolean;
  fiatStatus: FiatTotalStatus;
  fiatDisplay: string;
  totalFiat: string | null;
  stale: boolean;
  staleAsOfMs: number | null;
}): AccountBalanceHead {
  const isEmpty = input.balancePhase === 'known' && !input.hasFunds;
  const headline = resolveHomeHeadline({
    balancePhase: input.balancePhase,
    isEmpty,
    fiatStatus: input.fiatStatus,
    fiatDisplay: input.fiatDisplay,
  });
  const unreadable = input.balancePhase === 'unreadable';
  const staleMarker = resolveHomeStaleMarker({
    stale: input.stale,
    staleAsOfMs: input.staleAsOfMs,
  });
  let subline: string | null = null;
  if (unreadable) subline = copy.ask.moneyUnavailable;
  else if (staleMarker) subline = staleMarker;
  else if (isEmpty) subline = copy.home.today('$0.00');

  return {
    eyebrow: copy.account.portfolio,
    headline,
    countUpAmount:
      !unreadable && headline === input.fiatDisplay ? input.totalFiat : null,
    subline,
    unreadable,
    accessibilityLabel: unreadable
      ? copy.home.balanceUnavailableRetryA11y
      : `${copy.account.portfolio} ${headline}`,
  };
}

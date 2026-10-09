import { copy } from '@/constants/copy';
import type {
  FiatTotalStatus,
  HoldingsSnapshot,
} from '@/src/features/balances/computeFiatTotal';
import { colors, radii, typography } from '@/src/ui/tokens';

export type HomeAskPhase = 'idle' | 'focused' | 'working' | 'answered';

export type HomeBalancePhase = 'loading' | 'unreadable' | 'known';

export function resolveHomeBalancePhase(
  quantityStatus: HoldingsSnapshot['quantityStatus'] | null | undefined,
): HomeBalancePhase {
  if (quantityStatus === 'ready') return 'known';
  if (quantityStatus === 'error' || quantityStatus === 'partial') {
    return 'unreadable';
  }
  return 'loading';
}

export function resolveHomeHeadline(args: {
  balancePhase: HomeBalancePhase;
  isEmpty: boolean;
  fiatStatus: FiatTotalStatus;
  fiatDisplay: string;
}): string {
  if (args.balancePhase === 'unreadable') return copy.home.balancePlaceholder;
  if (args.fiatStatus === 'zero' || args.isEmpty) return '$0.00';
  return args.fiatDisplay;
}

export type HomeEmptyPresentation = {
  isEmpty: boolean;
  showEmptyCopy: boolean;
  showUnreadableCopy: boolean;
  sendDisabled: boolean;
  fundLive: boolean;
  /**
   * Exact funded holdings stay visible independently of Moving. Keeping the
   * boolean in the presentation model means an empty or unreadable balance
   * cannot make it through just because the rendered form changed.
   */
  showFundSend: boolean;
  showSuggestedAsks: boolean;
  showAskSkeleton: boolean;
  showAnswer: boolean;
  showMovingStrip: boolean;
  showMovingSlot: boolean;
  showHowItWorksLink: boolean;
};

export type MovingPhase = 'unknown' | 'pending' | 'settled';

export const ASK_SWAP_CARD = {
  minHeight: 220,
  borderRadius: radii.card,
  backgroundColor: colors.glassFillSheet,
  borderWidth: 0.5,
  borderColor: colors.glassStrokeSheet,
} as const;

export const ASK_SKELETON_WHAT = 'swap';

export function resolveHomeEmptyPresentation(args: {
  hasHoldings: boolean;
  balancesKnown: boolean;
  sendFlagEnabled: boolean;
  askPhase: HomeAskPhase;
  movingReady?: boolean;
  movingPhase?: MovingPhase;
  balancesUnreadable?: boolean;
  liveCardCount?: number;
  nudgeHydrated?: boolean;
  nudgeReadFailed?: boolean;
  firstAnsweredAt?: string | null;
}): HomeEmptyPresentation {
  const balancesUnreadable = args.balancesUnreadable === true;
  const doorIdle = (args.liveCardCount ?? 0) === 0;
  const isEmpty = args.balancesKnown && !balancesUnreadable && !args.hasHoldings;
  const chromeIdle = args.askPhase === 'idle';
  return {
    isEmpty,
    showEmptyCopy: isEmpty && chromeIdle && doorIdle,
    showUnreadableCopy: balancesUnreadable && chromeIdle,
    sendDisabled: isEmpty || balancesUnreadable || !args.sendFlagEnabled,
    fundLive: true,
    showFundSend: chromeIdle && doorIdle,
    showAskSkeleton: args.askPhase === 'working',
    showAnswer: args.askPhase === 'answered',
    showMovingStrip: chromeIdle && args.balancesKnown && args.movingReady === true,
    showSuggestedAsks:
      chromeIdle && args.balancesKnown && !balancesUnreadable && doorIdle,
    showMovingSlot:
      chromeIdle &&
      (args.movingPhase === 'pending' || args.movingReady === true),
    showHowItWorksLink:
      args.nudgeHydrated === true &&
      args.nudgeReadFailed !== true &&
      args.firstAnsweredAt == null &&
      doorIdle,
  };
}

export function resolveHomeBagSublines(args: {
  balancePhase: HomeBalancePhase;
  isEmpty: boolean;
}): { holdLine: string | null; todayLine: string | null } {
  if (args.balancePhase !== 'known') {
    return { holdLine: null, todayLine: null };
  }
  return {
    holdLine: copy.v1.youHoldThis,
    todayLine: args.isEmpty ? copy.home.today('$0.00') : null,
  };
}

export function resolveAskFollowUps(hasHoldings: boolean): string[] {
  if (!hasHoldings) return [];
  return ['SOL', 'USDC'];
}

export function homeDollarStyle() {
  return {
    color: colors.ink,
    fontSize: typography.dollar,
    fontFamily: typography.face('600'),
    fontWeight: '600' as const,
    letterSpacing: typography.dollar * -0.035,
  };
}

export function resolveSendGateNotice(args: {
  isEmpty: boolean;
  balancesUnreadable: boolean;
  sendFlagEnabled: boolean;
}): string | null {
  if (args.balancesUnreadable) return copy.account.sendGateUnreadable;
  if (args.isEmpty) return copy.account.sendGateEmpty;
  if (!args.sendFlagEnabled) return copy.account.sendGateOff;
  return null;
}

export type FirstRunIntent = 'new' | 'restore';
export type FirstRunStep = 'name' | 'how' | 'fund';

export const FIRST_RUN_ROUTES: Record<
  FirstRunStep,
  `/onboarding/${FirstRunStep}`
> = {
  name: '/onboarding/name',
  how: '/onboarding/how',
  fund: '/onboarding/fund',
};

let pending = false;

/** The Welcome screen records which button was pressed. */
export function recordFirstRunIntent(intent: FirstRunIntent): void {
  pending = intent === 'new';
}

/** The signed-in shell asks this once a session is formed. */
export function isFirstRunPending(): boolean {
  return pending;
}

/** 04 either button, or any exit to Home: the strip never shows twice. */
export function completeFirstRun(): void {
  pending = false;
}

export function resetFirstRunForTest(): void {
  pending = false;
}

export type FirstRunGate =
  | 'hold'
  | 'welcome'
  | 'resume'
  | 'lock-setup'
  | 'unlock'
  | 'home'
  | 'render';

export function resolveFirstRunGate(input: {
  phase: 'booting' | 'ready';
  destination:
    | 'restoring'
    | 'welcome'
    | 'resume'
    | 'lock-setup'
    | 'unlock'
    | 'home';
  pending: boolean;
}): FirstRunGate {
  if (input.phase === 'booting' || input.destination === 'restoring') {
    return 'hold';
  }
  if (input.destination !== 'home') return input.destination;
  return input.pending ? 'render' : 'home';
}

/** 02 — the field's placeholder and the name kept when the person skips. */
export const PORTFOLIO_NAME_DEFAULT = 'My portfolio';
export const PORTFOLIO_NAME_MAX = 32;
export const PORTFOLIO_NAME_STORAGE_KEY = '@corso/onboarding/portfolioName';

/**
 * Trim, collapse inner whitespace, cap the length. An empty answer is not a
 * name: it returns null so the caller keeps the default instead of saving ''.
 */
export function normalizePortfolioName(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (collapsed.length === 0) return null;
  return collapsed.slice(0, PORTFOLIO_NAME_MAX).trimEnd();
}

/**
 * 04 cash card. Cash is USDC at six decimals, shown as dollars to the cent
 * (floored — never rounded up past what is held). Until the read lands, or if
 * it fails, the card shows the placeholder: `$0.00` is a claim, not a default.
 */
export function resolveFirstRunCashLabel(state: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  atomic: bigint | null;
  placeholder: string;
}): string {
  if (state.status !== 'ready' || state.atomic === null || state.atomic < 0n) {
    return state.placeholder;
  }
  const cents = state.atomic / 10_000n;
  const dollars = (cents / 100n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const rem = (cents % 100n).toString().padStart(2, '0');
  return `$${dollars}.${rem}`;
}

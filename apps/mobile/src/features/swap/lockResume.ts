import type { SwapToken, SwapTokenSymbol } from './tokens';

type Owner = { type: string; address: string } | null;
export type SwapResumeInputs = {
  owner: Exclude<Owner, null>;
  cluster: 'devnet' | 'mainnet-beta';
  paySymbol: SwapTokenSymbol;
  payPick: SwapToken | null;
  receivePick: SwapToken | null;
  amount: string;
};
export const SWAP_RESUME_TTL_MS = 5 * 60_000;
let active: (() => SwapResumeInputs | null) | null = null;
let invalidateActive: (() => void) | null = null;
let suspended: { inputs: SwapResumeInputs; at: number } | null = null;

function token(value: SwapToken | null): SwapToken | null {
  return value && { mint: value.mint, symbol: value.symbol, decimals: value.decimals };
}
/** Only input fields cross the lock boundary; orders and signing state have no slot. */
export function registerSwapResume(read: () => SwapResumeInputs | null, invalidate: () => void = () => {}): () => void {
  active = read;
  invalidateActive = invalidate;
  return () => { if (active === read) { active = null; invalidateActive = null; } };
}
/** First departure wins, so a later idle/resume lock cannot extend the TTL. */
export function suspendSwapInputs(now = Date.now()): void {
  if (suspended) return;
  const value = active?.();
  if (!value) return;
  suspended = {
    at: now,
    inputs: {
      owner: { type: value.owner.type, address: value.owner.address },
      cluster: value.cluster, paySymbol: value.paySymbol,
      payPick: token(value.payPick), receivePick: token(value.receivePick), amount: value.amount,
    },
  };
}
/** The lock revokes the active quote synchronously, before navigation/unmount. */
export function lockSwapInputs(now = Date.now()): void {
  suspendSwapInputs(now);
  invalidateActive?.();
}
function valid(owner: Owner, now: number): boolean {
  const elapsed = suspended ? now - suspended.at : NaN;
  const matches = Boolean(owner && suspended && owner.type === suspended.inputs.owner.type && owner.address === suspended.inputs.owner.address);
  if (!matches || !Number.isFinite(elapsed) || elapsed < 0 || elapsed >= SWAP_RESUME_TTL_MS) {
    suspended = null;
    return false;
  }
  return true;
}
export function swapUnlockDestination(owner: Owner, now = Date.now()): '/swap' | '/(app)' {
  return valid(owner, now) ? '/swap' : '/(app)';
}
export function takeSwapResume(owner: Owner, cluster: SwapResumeInputs['cluster'], now = Date.now()): SwapResumeInputs | null {
  if (!valid(owner, now)) return null;
  const value = suspended!;
  suspended = null;
  return value.inputs.cluster === cluster ? value.inputs : null;
}
/** A short return to a still-mounted composer must not leave an old recovery. */
export function resumeMountedSwap(): void { if (active) suspended = null; }
export function clearSwapResume(): void { suspended = null; }

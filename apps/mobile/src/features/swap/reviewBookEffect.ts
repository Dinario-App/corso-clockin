import {
  computeFiatTotal,
  type HoldingsSnapshot,
  type FiatTotalResult,
} from '@/src/features/balances/computeFiatTotal';
import { classifyHolding } from '@/src/features/balances/majors';
import type { FiatTotalState } from '@/src/features/balances/useFiatTotal';
import type { FrozenSwapReviewIntent } from './swapReviewIntent';
import { SOL_MINT, usdcMintForCluster, type SwapToken } from './tokens';

export type ReviewBookEffectInput = {
  intent: Pick<
    FrozenSwapReviewIntent,
    | 'instructionVersion'
    | 'inputMint'
    | 'outputMint'
    | 'inAmount'
    | 'outAmount'
    | 'networkFeeLamports'
    | 'accountRentLamports'
  >;
  payToken: SwapToken;
  receiveToken: SwapToken;
  fiat: Pick<FiatTotalState, 'status' | 'holdings' | 'quotes' | 'stale'>;
  nowMs: number;
  address: string | null;
  cluster: HoldingsSnapshot['cluster'];
};
function atomic(value: string | null | undefined): bigint | null {
  return typeof value === 'string' && /^\d{1,80}$/.test(value)
    ? BigInt(value)
    : null;
}
function cents(value: string): bigint {
  return BigInt(value.replace('.', ''));
}
function summary(snapshot: HoldingsSnapshot, value: FiatTotalResult) {
  if (value.status !== 'fully_priced' || value.totalFiat === null) return null;
  const total = cents(value.totalFiat);
  if (total <= 0n) return null;
  let major = 0n;
  let cash = 0n;
  for (let i = 0; i < snapshot.lines.length; i++) {
    const section = classifyHolding(snapshot.lines[i], snapshot.cluster);
    const amount = value.lines[i]?.fiatAmount;
    if (section === 'hidden') continue;
    if (amount === null || amount === undefined) return null;
    if (section === 'major') major += cents(amount);
    if (section === 'cash') cash += cents(amount);
  }
  return {
    share: ((major * 100n + total / 2n) / total).toString(),
    cash: `${cash / 100n}.${(cash % 100n).toString().padStart(2, '0')}`,
  };
}
/** Display-only projection using frozen net output and the existing spot/peg
 * valuation policy. Unknown facts suppress the entire estimate. No transaction
 * construction or signing authority enters this presenter. */
export function presentReviewBookEffect(
  args: ReviewBookEffectInput,
): string | null {
  const { fiat, intent, payToken, receiveToken, nowMs, address, cluster } =
    args;
  if (intent.instructionVersion === 'V2') return null;
  const snapshot = fiat.holdings;
  if (
    !snapshot ||
    !address ||
    !cluster ||
    snapshot.address !== address ||
    snapshot.cluster !== cluster ||
    fiat.stale ||
    fiat.status !== 'fully_priced' ||
    snapshot.quantityStatus !== 'ready' ||
    !Number.isFinite(nowMs) ||
    !Number.isFinite(snapshot.asOfMs) ||
    snapshot.asOfMs > nowMs
  )
    return null;
  if (
    payToken.mint !== intent.inputMint ||
    receiveToken.mint !== intent.outputMint ||
    payToken.mint === receiveToken.mint
  )
    return null;
  const input = atomic(intent.inAmount);
  const output = atomic(intent.outAmount);
  const network = atomic(intent.networkFeeLamports);
  const rent = atomic(intent.accountRentLamports);
  if (
    input === null ||
    output === null ||
    input <= 0n ||
    output <= 0n ||
    network === null ||
    rent === null
  )
    return null;
  const costs = network + rent;
  const lines = snapshot.lines.map((line) => ({ ...line }));
  if (new Set(lines.map((line) => line.mint)).size !== lines.length)
    return null;
  const pay = lines.find((line) => line.mint === payToken.mint);
  if (!pay?.includeInHomeTotal || pay.decimals !== payToken.decimals)
    return null;
  let receive = lines.find((line) => line.mint === receiveToken.mint);
  if (!receive) {
    // Without a held-token valuationEligible fact, a new arbitrary mint cannot
    // acquire verified/liquid status from its symbol or from a price alone.
    const native = receiveToken.mint === SOL_MINT;
    const cash = receiveToken.mint === usdcMintForCluster(cluster);
    if (!native && !cash) return null;
    receive = {
      ...receiveToken,
      symbol: native ? 'SOL' : 'USDC',
      atomic: '0',
      includeInHomeTotal: true,
    };
    lines.push(receive);
  }
  if (!receive.includeInHomeTotal || receive.decimals !== receiveToken.decimals)
    return null;
  const payAmount = atomic(pay.atomic);
  const receiveAmount = atomic(receive.atomic);
  if (payAmount === null || receiveAmount === null || payAmount < input)
    return null;
  const sol = lines.find((line) => line.mint === SOL_MINT);
  if (costs > 0n) {
    const native = atomic(sol?.nativeAtomic);
    if (
      !sol?.includeInHomeTotal ||
      native === null ||
      native < costs + (payToken.mint === SOL_MINT ? input : 0n)
    )
      return null;
  }
  const before = summary(
    snapshot,
    computeFiatTotal({ holdings: snapshot, quotes: fiat.quotes, nowMs }),
  );
  if (!before) return null;
  pay.atomic = (payAmount - input).toString();
  receive.atomic = (receiveAmount + output).toString();
  if (costs > 0n && sol) {
    const amount = atomic(sol.atomic);
    if (amount === null || amount < costs) return null;
    sol.atomic = (amount - costs).toString();
  }
  const projected = { ...snapshot, lines };
  const after = summary(
    projected,
    computeFiatTotal({ holdings: projected, quotes: fiat.quotes, nowMs }),
  );
  if (!after) return null;
  return `Estimated: Majors go ${before.share}% → ${after.share}%. Cash $${after.cash}.`;
}

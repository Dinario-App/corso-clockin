import type { RoutineDraft, RoutineRecord } from './types';

function number(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, '');
}
function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function routineStatusLabel(status: string, armingOpen: boolean): string {
  if (!armingOpen && (status === 'armed' || status === 'staged')) {
    return 'Not active yet';
  }
  return status;
}

export function buildRoutineReviewPresentation(draft: RoutineDraft) {
  return {
    title: 'Review routine',
    position: draft.positionSymbol,
    upperLeg: `${money(draft.baselinePriceUsd * (1 + draft.upLegPct / 100))} · +${number(draft.upLegPct)}%`,
    lowerLeg: `${money(draft.baselinePriceUsd * (1 - draft.downLegPct / 100))} · -${number(draft.downLegPct)}%`,
    amount: draft.amountKind === 'all'
      ? `All ${draft.positionSymbol}`
      : draft.amountKind === 'fraction'
        ? `${number((draft.amountValue ?? 0) * 100)}% of ${draft.positionSymbol}`
        : draft.amountKind === 'usd'
          ? `${money(draft.amountValue ?? 0)} of ${draft.positionSymbol}`
          : `${number(draft.amountValue ?? 0)} ${draft.positionSymbol}`,
    consent: "You'll sign each time this fires. Nothing sells without you.",
  };
}

export function buildTriggeredRoutineAsk(
  routine: Pick<
    RoutineRecord,
    'status' | 'positionSymbol' | 'amountKind' | 'amountValue'
  > | (RoutineDraft & { status: string }),
): string | null {
  if (routine.status !== 'triggered') return null;
  const receive = routine.positionSymbol === 'SOL' ? 'USDC' : 'SOL';
  const rawAmount = routine.amountValue === null
    ? null
    : Number(routine.amountValue);
  if (routine.amountValue !== null && (!Number.isFinite(rawAmount) || rawAmount! <= 0)) {
    return null;
  }
  const amount = routine.amountKind === 'all'
    ? 'all'
    : routine.amountKind === 'fraction'
      ? `${number(rawAmount! * 100)}% of`
      : routine.amountKind === 'usd'
        ? `$${number(rawAmount!)} of`
        : number(rawAmount!);
  return `Swap ${amount} ${routine.positionSymbol} to ${receive}`;
}

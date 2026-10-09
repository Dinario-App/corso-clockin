export type RoutineAmountKind = 'all' | 'fraction' | 'usd' | 'absolute';

export type RoutineDraft = {
  sourceText: string;
  kind: 'exit';
  positionMint: string;
  positionSymbol: string;
  baselinePriceUsd: number;
  upLegPct: number;
  downLegPct: number;
  amountKind: RoutineAmountKind;
  amountValue: number | null;
};
export type RoutineStatus =
  | 'staged'
  | 'armed'
  | 'triggered'
  | 'approved'
  | 'executed'
  | 'declined'
  | 'expired'
  | 'canceled';

export type RoutineRecord = Omit<
  RoutineDraft,
  'baselinePriceUsd' | 'upLegPct' | 'downLegPct' | 'amountValue'
> & {
  id: string;
  walletAddress: string;
  baselinePriceUsd: string;
  baselineAt: string;
  upLegPct: string;
  downLegPct: string;
  amountValue: string | null;
  status: RoutineStatus;
  triggeredAt: string | null;
  triggeredLeg: 'up' | 'down' | null;
  triggeredPriceUsd: string | null;
  approvedAt: string | null;
  approvingStepUpSessionId: string | null;
  executedSwapSignature: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type RoutineStageHolding = {
  mint: string;
  balanceBaseUnits: string;
};

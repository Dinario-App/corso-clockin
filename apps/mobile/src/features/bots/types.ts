export const BOT_RULE_KINDS = [
  'dip',
  'take_profit',
  'stop_loss',
  'dca',
] as const;
export type BotRuleKind = (typeof BOT_RULE_KINDS)[number];

export type BotRule =
  | { kind: 'dip'; dropPct: string }
  | { kind: 'take_profit'; risePct: string }
  | { kind: 'stop_loss'; dropPct: string }
  | { kind: 'dca'; everyMs: number };

export const BOT_STATUSES = [
  'setting_up',
  'live',
  'firing',
  'paused',
  'revoking',
  'killed',
  'expired',
  'ended',
] as const;
export type BotStatus = (typeof BOT_STATUSES)[number];

export const BOT_CAN_NEVER = [
  'transfer_out_or_withdraw',
  'exceed_cap',
  'outlive_expiry',
  'sign_anything_but_swap',
] as const;
export type BotCanNever = (typeof BOT_CAN_NEVER)[number];

export const BOT_KEY_STATUSES = [
  'none',
  'approving',
  'active',
  'revoking',
  'revoked',
  'expired',
] as const;
export type BotKeyStatus = (typeof BOT_KEY_STATUSES)[number];

export const BOT_FIRE_OUTCOMES = [
  'submitting',
  'landed',
  'failed',
  'dropped',
  'uncertain',
  'skipped',
  'assembly_failed',
  'sign_failed',
] as const;
export type BotFireOutcome = (typeof BOT_FIRE_OUTCOMES)[number] | string;

export type BotFill =
  | {
      status: 'landed';
      signature: string;
      slot: number;
      inBaseUnits: string;
      outBaseUnits: string;
    }
  | { status: 'pending'; signature: string }
  | { status: 'failed'; signature: string }
  | { status: 'unreadable'; signature: string };

export type BotBroadcastBeforeKill = {
  fireId: string;
  signature: string;
  outcome: BotFireOutcome;
  fill: BotFill | null;
};

export type BotKillView =
  | null
  | {
      state: 'revoking';
      startedAt: string;
      broadcastBeforeKill: BotBroadcastBeforeKill[];
    }
  | {
      state: 'killed';
      revokedAt: string;
      revokeSignature: string;
      broadcastBeforeKill: BotBroadcastBeforeKill[];
    };

export type BotExpiryView = {
  expiresAt: string;
  state: 'active' | 'expiring_soon' | 'expired';
  msLeft: number;
  nudge: boolean;
  renewable: boolean;
};

export type BotFireView = {
  /** Absent on old servers; no fee amount is invented for those receipts. */
  platformFee?: {
    bps: number;
    amount: string;
    mint: string;
    destination: string | null;
  } | null;
  id: string;
  at: string;
  outcome: BotFireOutcome;
  signature: string | null;
  fireSizeBaseUnits: string;
  fill: BotFill | null;
};

export const BOT_SUSPENSION_REASONS = ['user', 'daily_cap', 'flags', 'global_pause', 'fee_changed'] as const;
export type BotSuspensionReason = (typeof BOT_SUSPENSION_REASONS)[number];

export type BotView = {
  suspensionReason?: string | null;
  suspendedBy?: BotSuspensionReason | null;
  id: string;
  walletAddress: string;
  rule: BotRule;
  ruleKind: BotRuleKind;
  status: BotStatus;
  scope: {
    can: {
      swap: {
        inputMint: string;
        outputMint: string;
        target: { mint: string; symbol: string };
      };
      perFireMaxBaseUnits: string;
      perDayMaxBaseUnits: string;
      perDayMaxFires: number;
      minOutBps: number;
      until: string;
    };
    canNever: readonly BotCanNever[];
  };
  key: {
    status: BotKeyStatus;
    revokedOnChain: boolean;
    standing: boolean;
    mandateAta: string | null;
    approvedBaseUnits: string | null;
    approveSignature: string | null;
  };
  revokeRequired?: boolean;
  pausedByCorso?: boolean;
  kill: BotKillView;
  expiry: BotExpiryView;
  fired: number;
  spentToday: { fires: number; baseUnits: string };
  fires: BotFireView[];
  createdAt: string;
  updatedAt: string;
};

/** An unsigned owner transaction the server issued (ApproveChecked or Revoke). */
export type BotUnsignedTransaction = {
  unsignedTransactionBase64: string;
  messageDigest: string;
  ownerSignatureIndex: number;
  lastValidBlockHeight: number;
};

export type BotRuleCatalogEntry = {
  kind: BotRuleKind;
  direction: 'quote_to_target' | 'target_to_quote';
  param: string;
  min: string;
  max: string;
  default: string;
  available: boolean;
};

export type BotPersonaId = 'dip_bot' | 'profit_taker' | 'dca_bot';

export type BotPersona = {
  id: BotPersonaId;
  ruleKind: BotRuleKind;
  /** The rule shape + its one number. Nothing about money. */
  rule: BotRule;
};

export type BotCatalog = {
  rules: BotRuleCatalogEntry[];
  personas: BotPersona[];
  canNever: readonly BotCanNever[];
  expiry: { defaultMs: number; maxMs: number };
};

/** The envelope the set-up screen Face-IDs: exactly what the scope card shows. */
export type BotEnvelope = {
  platformFeeBps?: number;
  rule: BotRule;
  target: { mint: string; symbol: string; priceUsd: string };
  quoteMint: string;
  amountBaseUnits: string;
  caps: {
    perFireMaxBaseUnits: string;
    perDayMaxFires: number;
    perDayMaxBaseUnits: string;
    minOutBps: number;
  };
  expiresAt: string;
  brainKind: 'default' | 'openai' | 'claude' | 'grok';
  renewsBotId?: string | null;
};

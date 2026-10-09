import { rememberDelegation, forgetConfirmedRevocation } from './delegationMarkers';
import { Buffer } from 'buffer';
import {
  BOT_CAN_NEVER,
  BOT_KEY_STATUSES,
  BOT_RULE_KINDS,
  BOT_STATUSES,
  BOT_SUSPENSION_REASONS,
  type BotBroadcastBeforeKill,
  type BotCatalog,
  type BotEnvelope,
  type BotFill,
  type BotKillView,
  type BotPersona,
  type BotRule,
  type BotRuleCatalogEntry,
  type BotUnsignedTransaction,
  type BotView,
} from './types';

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type BotMessageSigner = (
  message: Uint8Array,
) => Promise<Uint8Array | null>;
/** Signs a server-issued owner transaction; returns the partially signed bytes, base64. */
export type BotTransactionSigner = (
  unsigned: BotUnsignedTransaction,
) => Promise<string | null>;

export type BotAction =
  | 'bot_author'
  | 'bot_arm'
  | 'bot_pause'
  | 'bot_resume'
  | 'bot_kill'
  | 'bot_list'
  | 'autopilot_revoke';

type Challenge = {
  nonce: string;
  expiresAt: string;
  message: Uint8Array;
};

export type BotClientInput = {
  enabled: boolean;
  walletAddress: string;
  currentWalletAddress: () => string | null | undefined;
  signMessage: BotMessageSigner;
  apiBaseUrl?: string | null;
  fetchImpl?: FetchLike;
  now?: () => number;
};

export type BotClientErrorCode =
  | 'disabled'
  | 'unavailable'
  | 'invalid_response'
  | 'expired'
  | 'declined'
  | 'session_changed'
  | 'rule_unavailable'
  | 'ata_in_use'
  | 'output_token_2022_fee_unsupported'
  | 'fee_changed'
  | 'resume_unavailable'
  | 'state_changed'
  | 'refused';

export class BotClientError extends Error {
  constructor(
    readonly code: BotClientErrorCode,
    readonly detail: {
      status?: number;
      error?: string;
      conflictingBotId?: string;
      message?: string;
      platformFeeBps?: number;
    } = {},
  ) {
    super(`Bot client: ${code}`);
    this.name = 'BotClientError';
  }
}

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSITIVE_DECIMAL = /^\d+(?:\.\d+)?$/;
const BASE_UNITS = /^\d{1,38}$/;
const DIGEST = /^[a-f0-9]{64}$/;

function baseUrl(input: string | null | undefined): string {
  const value = input?.trim() || process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!value) throw new BotClientError('unavailable');
  return value.replace(/\/$/, '');
}

function requireLiveWallet(input: BotClientInput): void {
  if (
    !ADDRESS.test(input.walletAddress) ||
    input.currentWalletAddress() !== input.walletAddress
  ) {
    throw new BotClientError('session_changed');
  }
}

function canonicalBase64(value: unknown): Uint8Array | null {
  if (
    typeof value !== 'string' ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  )
    return null;
  const decoded = Buffer.from(value, 'base64');
  return decoded.length > 0 && decoded.toString('base64') === value
    ? decoded
    : null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new BotClientError('invalid_response');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseChallenge(
  value: unknown,
  action: BotAction,
  walletAddress: string,
  now: number,
): Challenge {
  if (!isRecord(value)) throw new BotClientError('invalid_response');
  const message = canonicalBase64(value.messageBase64);
  const expiresAtMs =
    typeof value.expiresAt === 'string'
      ? Date.parse(value.expiresAt)
      : Number.NaN;
  if (
    value.action !== action ||
    value.walletAddress !== walletAddress ||
    typeof value.bindingDigest !== 'string' ||
    !DIGEST.test(value.bindingDigest) ||
    typeof value.nonce !== 'string' ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(value.nonce) ||
    !Number.isFinite(expiresAtMs) ||
    message === null
  ) {
    throw new BotClientError('invalid_response');
  }
  if (expiresAtMs <= now) throw new BotClientError('expired');
  return { nonce: value.nonce, expiresAt: value.expiresAt as string, message };
}

async function post(
  args: BotClientInput,
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return (args.fetchImpl ?? fetch)(`${baseUrl(args.apiBaseUrl)}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {
    throw new BotClientError('unavailable');
  });
}

/** Challenge → Face-ID signature over the exact issued message → nonce + signature. */
async function issueAndSign(
  args: BotClientInput & {
    action: BotAction;
    challengePath: string;
    challengeBody: Record<string, unknown>;
  },
): Promise<{ nonce: string; signature: string }> {
  if (!args.enabled) throw new BotClientError('disabled');
  requireLiveWallet(args);
  const response = await post(args, args.challengePath, args.challengeBody);
  if (!response.ok) throw await refusal(response);
  const challenge = parseChallenge(
    await readJson(response),
    args.action,
    args.walletAddress,
    (args.now ?? Date.now)(),
  );
  requireLiveWallet(args);
  let bytes: Uint8Array | null;
  try {
    bytes = await args.signMessage(challenge.message);
  } catch {
    throw new BotClientError('declined');
  }
  if (bytes === null) throw new BotClientError('declined');
  if (bytes.length !== 64) throw new BotClientError('invalid_response');
  if (Date.parse(challenge.expiresAt) <= (args.now ?? Date.now)()) {
    throw new BotClientError('expired');
  }
  requireLiveWallet(args);
  return {
    nonce: challenge.nonce,
    signature: Buffer.from(bytes).toString('base64'),
  };
}

/** A non-2xx answer, mapped to the few codes the UI names honestly. */
async function refusal(response: Response): Promise<BotClientError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const error =
    isRecord(body) && typeof body.error === 'string' ? body.error : undefined;
  const conflictingBotId =
    isRecord(body) && typeof body.conflictingBotId === 'string'
      ? body.conflictingBotId
      : undefined;
  if (error === 'output_token_2022_fee_unsupported' || error === 'fee_changed') {
    return new BotClientError(error, {
      status: response.status,
      error,
      platformFeeBps:
        isRecord(body) && Number.isInteger(body.platformFeeBps) && typeof body.platformFeeBps === 'number' && body.platformFeeBps >= 0 && body.platformFeeBps <= 255
          ? body.platformFeeBps : undefined,
      message:
        isRecord(body) && typeof body.message === 'string'
          ? body.message
          : undefined,
    });
  }
  if (error === 'execution_suspended') return new BotClientError('resume_unavailable', { status: response.status, error });
  if (error === 'mandate_conflict' || error === 'autopilot_auth_mismatch') return new BotClientError('state_changed', { status: response.status, error });

  if (error === 'bot_rule_unavailable') {
    return new BotClientError('rule_unavailable', {
      status: response.status,
      error,
    });
  }
  if (error === 'delegation_ata_in_use') {
    return new BotClientError('ata_in_use', {
      status: response.status,
      error,
      conflictingBotId,
    });
  }
  if (response.status >= 500 || response.status === 503) {
    return new BotClientError('unavailable', {
      status: response.status,
      error,
    });
  }
  return new BotClientError('refused', { status: response.status, error });
}

function parseDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function parseRule(value: unknown): BotRule {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    throw new BotClientError('invalid_response');
  }
  switch (value.kind) {
    case 'dip':
    case 'stop_loss':
      if (
        typeof value.dropPct !== 'string' ||
        !POSITIVE_DECIMAL.test(value.dropPct)
      ) {
        throw new BotClientError('invalid_response');
      }
      return { kind: value.kind, dropPct: value.dropPct };
    case 'take_profit':
      if (
        typeof value.risePct !== 'string' ||
        !POSITIVE_DECIMAL.test(value.risePct)
      ) {
        throw new BotClientError('invalid_response');
      }
      return { kind: 'take_profit', risePct: value.risePct };
    case 'dca':
      if (
        typeof value.everyMs !== 'number' ||
        !Number.isInteger(value.everyMs) ||
        value.everyMs <= 0
      ) {
        throw new BotClientError('invalid_response');
      }
      return { kind: 'dca', everyMs: value.everyMs };
    default:
      throw new BotClientError('invalid_response');
  }
}

function parseFill(value: unknown): BotFill | null {
  if (value === null) return null;
  if (!isRecord(value) || typeof value.signature !== 'string') {
    throw new BotClientError('invalid_response');
  }
  switch (value.status) {
    case 'landed':
      if (
        typeof value.slot !== 'number' ||
        typeof value.inBaseUnits !== 'string' ||
        !/^\d+$/.test(value.inBaseUnits) ||
        typeof value.outBaseUnits !== 'string' ||
        !/^\d+$/.test(value.outBaseUnits)
      ) {
        throw new BotClientError('invalid_response');
      }
      return {
        status: 'landed',
        signature: value.signature,
        slot: value.slot,
        inBaseUnits: value.inBaseUnits,
        outBaseUnits: value.outBaseUnits,
      };
    case 'pending':
    case 'failed':
    case 'unreadable':
      return { status: value.status, signature: value.signature };
    default:
      throw new BotClientError('invalid_response');
  }
}

function parseBroadcast(value: unknown): BotBroadcastBeforeKill[] {
  if (!Array.isArray(value)) throw new BotClientError('invalid_response');
  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.fireId !== 'string' ||
      typeof entry.signature !== 'string' ||
      typeof entry.outcome !== 'string'
    ) {
      throw new BotClientError('invalid_response');
    }
    return {
      fireId: entry.fireId,
      signature: entry.signature,
      outcome: entry.outcome,
      fill: parseFill(entry.fill ?? null),
    };
  });
}

function parseKill(value: unknown): BotKillView {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new BotClientError('invalid_response');
  if (value.state === 'revoking') {
    if (!parseDate(value.startedAt))
      throw new BotClientError('invalid_response');
    return {
      state: 'revoking',
      startedAt: value.startedAt,
      broadcastBeforeKill: parseBroadcast(value.broadcastBeforeKill),
    };
  }
  if (value.state === 'killed') {
    if (
      !parseDate(value.revokedAt) ||
      typeof value.revokeSignature !== 'string'
    ) {
      throw new BotClientError('invalid_response');
    }
    return {
      state: 'killed',
      revokedAt: value.revokedAt,
      revokeSignature: value.revokeSignature,
      broadcastBeforeKill: parseBroadcast(value.broadcastBeforeKill),
    };
  }
  throw new BotClientError('invalid_response');
}

/** Refuses a view that is not this wallet's, or that carries an unknown state. */
export function parseBotView(value: unknown, walletAddress: string): BotView {
  if (!isRecord(value)) throw new BotClientError('invalid_response');
  if (value.suspendedBy !== undefined && value.suspendedBy !== null && !(BOT_SUSPENSION_REASONS as readonly string[]).includes(String(value.suspendedBy))) throw new BotClientError('invalid_response');
  if (
    value.pausedByCorso !== undefined && typeof value.pausedByCorso !== 'boolean'
  ) throw new BotClientError('invalid_response');
  if (
    value.revokeRequired !== undefined &&
    typeof value.revokeRequired !== 'boolean'
  )
    throw new BotClientError('invalid_response');
  const scope = value.scope;
  const key = value.key;
  const expiry = value.expiry;
  const spentToday = value.spentToday;
  if (
    typeof value.id !== 'string' ||
    !UUID.test(value.id) ||
    value.walletAddress !== walletAddress ||
    typeof value.status !== 'string' ||
    !(BOT_STATUSES as readonly string[]).includes(value.status) ||
    typeof value.ruleKind !== 'string' ||
    !(BOT_RULE_KINDS as readonly string[]).includes(value.ruleKind) ||
    !isRecord(scope) ||
    !isRecord(scope.can) ||
    !isRecord(scope.can.swap) ||
    !isRecord(scope.can.swap.target) ||
    typeof scope.can.swap.inputMint !== 'string' ||
    !ADDRESS.test(scope.can.swap.inputMint) ||
    typeof scope.can.swap.outputMint !== 'string' ||
    !ADDRESS.test(scope.can.swap.outputMint) ||
    typeof scope.can.swap.target.mint !== 'string' ||
    !ADDRESS.test(scope.can.swap.target.mint) ||
    typeof scope.can.swap.target.symbol !== 'string' ||
    scope.can.swap.target.symbol.length === 0 ||
    typeof scope.can.perFireMaxBaseUnits !== 'string' ||
    !BASE_UNITS.test(scope.can.perFireMaxBaseUnits) ||
    typeof scope.can.perDayMaxBaseUnits !== 'string' ||
    !BASE_UNITS.test(scope.can.perDayMaxBaseUnits) ||
    typeof scope.can.perDayMaxFires !== 'number' ||
    typeof scope.can.minOutBps !== 'number' ||
    !parseDate(scope.can.until) ||
    !Array.isArray(scope.canNever) ||
    !isRecord(key) ||
    typeof key.status !== 'string' ||
    !(BOT_KEY_STATUSES as readonly string[]).includes(key.status) ||
    typeof key.revokedOnChain !== 'boolean' ||
    typeof key.standing !== 'boolean' ||
    !isRecord(expiry) ||
    !parseDate(expiry.expiresAt) ||
    !['active', 'expiring_soon', 'expired'].includes(String(expiry.state)) ||
    typeof expiry.msLeft !== 'number' ||
    typeof expiry.nudge !== 'boolean' ||
    typeof expiry.renewable !== 'boolean' ||
    typeof value.fired !== 'number' ||
    !isRecord(spentToday) ||
    typeof spentToday.fires !== 'number' ||
    typeof spentToday.baseUnits !== 'string' ||
    !/^\d+$/.test(spentToday.baseUnits) ||
    !Array.isArray(value.fires) ||
    !parseDate(value.createdAt) ||
    !parseDate(value.updatedAt)
  ) {
    throw new BotClientError('invalid_response');
  }
  const rule = parseRule(value.rule);
  if (rule.kind !== value.ruleKind)
    throw new BotClientError('invalid_response');
  const canNever = scope.canNever.filter(
    (entry): entry is BotView['scope']['canNever'][number] =>
      (BOT_CAN_NEVER as readonly string[]).includes(String(entry)),
  );
  // The hero list is fixed by the server; a shorter list is not something this
  // client renders as a wider scope.
  if (canNever.length !== BOT_CAN_NEVER.length)
    throw new BotClientError('invalid_response');
  const fires = value.fires.map((fire) => {
    if (
      !isRecord(fire) ||
      typeof fire.id !== 'string' ||
      !parseDate(fire.at) ||
      typeof fire.outcome !== 'string' ||
      !(fire.signature === null || typeof fire.signature === 'string') ||
      typeof fire.fireSizeBaseUnits !== 'string' ||
      !/^\d+$/.test(fire.fireSizeBaseUnits)
    ) {
      throw new BotClientError('invalid_response');
    }
    return {
      id: fire.id,
      at: fire.at,
      outcome: fire.outcome,
      signature: fire.signature,
      fireSizeBaseUnits: fire.fireSizeBaseUnits,
      platformFee: parsePlatformFee(fire.platformFee),
      fill: parseFill(fire.fill ?? null),
    };
  });
  return {
    id: value.id,
    suspensionReason: typeof value.suspensionReason === 'string' ? value.suspensionReason : null,
    walletAddress,
    rule,
    ruleKind: rule.kind,
    status: value.status as BotView['status'],
    scope: {
      can: {
        swap: {
          inputMint: scope.can.swap.inputMint,
          outputMint: scope.can.swap.outputMint,
          target: {
            mint: scope.can.swap.target.mint,
            symbol: scope.can.swap.target.symbol,
          },
        },
        perFireMaxBaseUnits: scope.can.perFireMaxBaseUnits,
        perDayMaxBaseUnits: scope.can.perDayMaxBaseUnits,
        perDayMaxFires: scope.can.perDayMaxFires,
        minOutBps: scope.can.minOutBps,
        until: scope.can.until,
      },
      canNever,
    },
    key: {
      status: key.status as BotView['key']['status'],
      revokedOnChain: key.revokedOnChain,
      standing: key.standing,
      mandateAta: typeof key.mandateAta === 'string' ? key.mandateAta : null,
      approvedBaseUnits:
        typeof key.approvedBaseUnits === 'string'
          ? key.approvedBaseUnits
          : null,
      approveSignature:
        typeof key.approveSignature === 'string' ? key.approveSignature : null,
    },
    revokeRequired: value.revokeRequired === true,
    pausedByCorso: value.pausedByCorso === true,
    suspendedBy: value.suspendedBy as 'user' | 'daily_cap' | 'flags' | 'global_pause' | 'fee_changed' | null | undefined,
    kill: parseKill(value.kill),
    expiry: {
      expiresAt: expiry.expiresAt,
      state: expiry.state as BotView['expiry']['state'],
      msLeft: expiry.msLeft,
      nudge: expiry.nudge,
      renewable: expiry.renewable,
    },
    fired: value.fired,
    spentToday: { fires: spentToday.fires, baseUnits: spentToday.baseUnits },
    fires,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function parseUnsignedTransaction(
  value: unknown,
): BotUnsignedTransaction {
  if (
    !isRecord(value) ||
    canonicalBase64(value.unsignedTransactionBase64) === null ||
    typeof value.messageDigest !== 'string' ||
    !DIGEST.test(value.messageDigest) ||
    typeof value.ownerSignatureIndex !== 'number' ||
    !Number.isInteger(value.ownerSignatureIndex) ||
    value.ownerSignatureIndex < 0 ||
    typeof value.lastValidBlockHeight !== 'number'
  ) {
    throw new BotClientError('invalid_response');
  }
  return {
    unsignedTransactionBase64: value.unsignedTransactionBase64 as string,
    messageDigest: value.messageDigest,
    ownerSignatureIndex: value.ownerSignatureIndex,
    lastValidBlockHeight: value.lastValidBlockHeight,
  };
}

async function parseBotResponse(
  response: Response,
  walletAddress: string,
): Promise<{ body: Record<string, unknown>; bot: BotView }> {
  if (!response.ok) throw await refusal(response);
  const body = await readJson(response);
  if (!isRecord(body)) throw new BotClientError('invalid_response');
  return { body, bot: parseBotView(body.bot, walletAddress) };
}

/** Static: the rules, the personas (rule-only), the fixed can-NEVER list. */
export async function fetchBotCatalog(args: {
  apiBaseUrl?: string | null;
  fetchImpl?: FetchLike;
}): Promise<BotCatalog> {
  const response = await (args.fetchImpl ?? fetch)(
    `${baseUrl(args.apiBaseUrl)}/v1/bots/catalog`,
    { method: 'GET' },
  ).catch(() => {
    throw new BotClientError('unavailable');
  });
  if (!response.ok) throw await refusal(response);
  const body = await readJson(response);
  if (
    !isRecord(body) ||
    !Array.isArray(body.rules) ||
    !Array.isArray(body.personas) ||
    !isRecord(body.expiry)
  ) {
    throw new BotClientError('invalid_response');
  }
  const rules: BotRuleCatalogEntry[] = body.rules.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.kind !== 'string' ||
      !(BOT_RULE_KINDS as readonly string[]).includes(entry.kind) ||
      (entry.direction !== 'quote_to_target' &&
        entry.direction !== 'target_to_quote') ||
      typeof entry.param !== 'string' ||
      typeof entry.min !== 'string' ||
      typeof entry.max !== 'string' ||
      typeof entry.default !== 'string' ||
      typeof entry.available !== 'boolean'
    ) {
      throw new BotClientError('invalid_response');
    }
    return {
      kind: entry.kind as BotRuleCatalogEntry['kind'],
      direction: entry.direction,
      param: entry.param,
      min: entry.min,
      max: entry.max,
      default: entry.default,
      available: entry.available,
    };
  });
  const personas: BotPersona[] = body.personas.map((entry) => {
    if (
      !isRecord(entry) ||
      !['dip_bot', 'profit_taker', 'dca_bot'].includes(String(entry.id)) ||
      typeof entry.ruleKind !== 'string'
    ) {
      throw new BotClientError('invalid_response');
    }
    // A persona carries a rule and NOTHING about money. Any cap, amount,
    // pair, or expiry on the wire is refused, not merely ignored.
    for (const forbidden of [
      'caps',
      'amountBaseUnits',
      'expiresAt',
      'target',
      'quoteMint',
    ]) {
      if (forbidden in entry && entry[forbidden] !== null) {
        throw new BotClientError('invalid_response');
      }
    }
    const rule = parseRule(entry.rule);
    if (rule.kind !== entry.ruleKind)
      throw new BotClientError('invalid_response');
    return { id: entry.id as BotPersona['id'], ruleKind: rule.kind, rule };
  });
  if (
    typeof body.expiry.defaultMs !== 'number' ||
    typeof body.expiry.maxMs !== 'number'
  ) {
    throw new BotClientError('invalid_response');
  }
  return {
    rules,
    personas,
    canNever: BOT_CAN_NEVER,
    expiry: { defaultMs: body.expiry.defaultMs, maxMs: body.expiry.maxMs },
  };
}

/** The fleet: every rule of this wallet, with kill state, expiry, spend, fires. */
export async function listBots(args: BotClientInput): Promise<BotView[]> {
  const auth = await issueAndSign({
    ...args,
    enabled: true,
    action: 'bot_list',
    challengePath: '/v1/bots/list/challenge',
    challengeBody: { walletAddress: args.walletAddress },
  });
  const response = await post(args, '/v1/bots/list', {
    walletAddress: args.walletAddress,
    ...auth,
  });
  requireLiveWallet(args);
  if (!response.ok) throw await refusal(response);
  const body = await readJson(response);
  if (!isRecord(body) || !Array.isArray(body.bots)) {
    throw new BotClientError('invalid_response');
  }
  const bots = body.bots.map((value) =>
    parseBotView(value, args.walletAddress),
  );
  requireLiveWallet(args);
  for (const bot of bots) {
    if (bot.key.revokedOnChain && bot.key.status === 'revoked') await forgetConfirmedRevocation(args.walletAddress, bot.id);
  }
  requireLiveWallet(args);
  return bots;
}

/**
 * Set up — Face-ID (a) over the envelope digest. The server stages the frozen
 * mandate and returns the unsigned ApproveChecked the owner will sign in (b).
 */
export async function authorBot(
  args: BotClientInput & {
    envelope: BotEnvelope;
  },
): Promise<{ bot: BotView; approve: BotUnsignedTransaction }> {
  const envelope = { ...args.envelope, walletAddress: args.walletAddress };
  const auth = await issueAndSign({
    ...args,
    action: 'bot_author',
    challengePath: '/v1/bots/challenge',
    challengeBody: envelope,
  });
  const response = await post(args, '/v1/bots', { ...envelope, ...auth });
  requireLiveWallet(args);
  const { body, bot } = await parseBotResponse(response, args.walletAddress);
  if (bot.status !== 'setting_up') throw new BotClientError('invalid_response');
  const approve = parseUnsignedTransaction(body.approve);
  requireLiveWallet(args);
  await rememberDelegation(args.walletAddress, bot.id);
  return { bot, approve };
}

/**
 * An id-addressed action: challenge, Face-ID, then the action itself.
 *
 * The challenge path defaults to `${base}/challenge`, which is what the API
 * mounts for arm / pause / resume / kill. A step that POSTs to a sub-path of
 * an already-challenged flow (Kill step 2 → `kill/submit`) must pass
 * `challengePath` explicitly: the API mounts one challenge per flow, and
 * challenging a route it does not mount 404s before anything is submitted —
 * which, for Kill, means an owner-signed Revoke that never lands.
 */
async function idAction(
  args: BotClientInput & {
    botId: string;
    action: Exclude<BotAction, 'bot_author' | 'bot_list'>;
    path: string;
    /** Verbatim challenge path; defaults to `${base}/challenge`. */
    challengePath?: string;
  },
  extraBody: Record<string, unknown> = {},
): Promise<{ body: Record<string, unknown>; bot: BotView }> {
  if (!UUID.test(args.botId)) throw new BotClientError('unavailable');
  const base = `/v1/bots/${args.botId}/${args.path}`;
  const auth = await issueAndSign({
    ...args,
    challengePath: args.challengePath ?? `${base}/challenge`,
    challengeBody: { walletAddress: args.walletAddress, ...(extraBody.platformFeeBps === undefined ? {} : { platformFeeBps: extraBody.platformFeeBps }) },
  });
  const response = await post(args, base, {
    walletAddress: args.walletAddress,
    ...extraBody,
    ...auth,
  });
  requireLiveWallet(args);
  const parsed = await parseBotResponse(response, args.walletAddress);
  requireLiveWallet(args);
  return parsed;
}

/**
 * Run — Face-ID (b): the owner signs the issued ApproveChecked (the scoped
 * key's on-chain cap), then the signed bytes ride the `bot_arm` action.
 */
export async function armBot(
  args: BotClientInput & {
    botId: string;
    approve: BotUnsignedTransaction;
    signTransaction: BotTransactionSigner;
  },
): Promise<BotView> {
  if (!args.enabled) throw new BotClientError('disabled');
  requireLiveWallet(args);
  let signed: string | null;
  try {
    signed = await args.signTransaction(args.approve);
  } catch {
    throw new BotClientError('declined');
  }
  if (signed === null) throw new BotClientError('declined');
  requireLiveWallet(args);
  const { bot } = await idAction(
    { ...args, action: 'bot_arm', path: 'arm' },
    { signedTransactionBase64: signed },
  );
  await rememberDelegation(args.walletAddress, bot.id);
  return bot;
}

export async function pauseBot(
  args: BotClientInput & { botId: string },
): Promise<BotView> {
  return (await idAction({ ...args, action: 'bot_pause', path: 'pause' })).bot;
}

export async function resumeBot(
  args: BotClientInput & { botId: string; platformFeeBps?: number },
): Promise<BotView> {
  return (await idAction({ ...args, action: 'bot_resume', path: 'resume' },
    args.platformFeeBps === undefined ? {} : { platformFeeBps: args.platformFeeBps }))
    .bot;
}

export type BotKillStep1 = {
  bot: BotView;
  /** Null when no key stands to revoke (or a newer rule holds it — `supersededBy`). */
  revoke: BotUnsignedTransaction | null;
  warning: string | null;
  supersededBy: string | null;
};

/**
 * Kill, step 1 (state: Revoking…): the server cancels the rule FIRST — from
 * any state, mid-fire included — and returns the unsigned Revoke.
 */
export async function killBot(
  args: BotClientInput & { botId: string },
): Promise<BotKillStep1> {
  const { body, bot } = await idAction({
    ...args,
    action: 'bot_kill',
    path: 'kill',
  });
  const revoke =
    body.revoke === null || body.revoke === undefined
      ? null
      : parseUnsignedTransaction(body.revoke);
  return {
    bot,
    revoke,
    warning: typeof body.warning === 'string' ? body.warning : null,
    supersededBy:
      typeof body.supersededBy === 'string' ? body.supersededBy : null,
  };
}

export async function killBotSubmit(
  args: BotClientInput & {
    botId: string;
    revoke: BotUnsignedTransaction;
    signTransaction: BotTransactionSigner;
  },
): Promise<BotView> {
  if (!args.enabled) throw new BotClientError('disabled');
  requireLiveWallet(args);
  let signed: string | null;
  try {
    signed = await args.signTransaction(args.revoke);
  } catch {
    throw new BotClientError('declined');
  }
  if (signed === null) throw new BotClientError('declined');
  requireLiveWallet(args);
  const { bot } = await idAction(
    {
      ...args,
      action: 'bot_kill',
      path: 'kill/submit',
      // The API mounts ONE challenge for the whole kill flow. Step 2 POSTs to
      // `kill/submit` but must challenge `kill/challenge`.
      challengePath: `/v1/bots/${args.botId}/kill/challenge`,
    },
    { signedTransactionBase64: signed },
  );
  if (bot.key.revokedOnChain && bot.key.status === 'revoked') await forgetConfirmedRevocation(args.walletAddress, bot.id);
  return bot;
}

function parsePlatformFee(
  value: unknown,
): BotView['fires'][number]['platformFee'] {
  if (value == null) return null;
  if (
    !isRecord(value) ||
    !Number.isInteger(value.bps) ||
    (value.bps as number) < 0 ||
    (value.bps as number) > 255 ||
    typeof value.amount !== 'string' ||
    !/^\d+$/.test(value.amount) ||
    !(
      typeof value.mint === 'string' &&
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.mint)
    ) ||
    !(
      value.destination === null ||
      (typeof value.destination === 'string' &&
        /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.destination))
    )
  ) {
    throw new BotClientError('invalid_response');
  }
  return {
    bps: value.bps as number,
    amount: value.amount,
    mint: value.mint as string,
    destination: value.destination as string | null,
  };
}

export async function revokeStoppedBot(
  args: BotClientInput & {
    botId: string;
    signTransaction: BotTransactionSigner;
  },
): Promise<void> {
  if (!UUID.test(args.botId)) throw new BotClientError('invalid_response');
  const path = `/v1/autopilot/mandates/${args.botId}/revoke`;
  const safety = { ...args, enabled: true };
  const auth = () =>
    issueAndSign({
      ...safety,
      action: 'autopilot_revoke',
      challengePath: `${path}/challenge`,
      challengeBody: { walletAddress: args.walletAddress },
    });
  const built = await post(safety, path, {
    walletAddress: args.walletAddress,
    ...(await auth()),
  });
  requireLiveWallet(args);
  if (!built.ok) throw await refusal(built);
  const body = await readJson(built);
  if (!isRecord(body)) throw new BotClientError('invalid_response');
  if (body.revoke === null) {
    if (body.warning) throw new BotClientError('refused');
    return; // no standing delegation; the caller re-reads the signed ledger view
  }
  const unsigned = parseUnsignedTransaction(body.revoke);
  requireLiveWallet(args);
  let signed: string | null;
  try {
    signed = await args.signTransaction(unsigned);
  } catch {
    throw new BotClientError('declined');
  }
  if (signed === null) throw new BotClientError('declined');
  requireLiveWallet(args);
  const authorization = await auth();
  requireLiveWallet(args);
  const submitted = await post(safety, `${path}/submit`, {
    walletAddress: args.walletAddress,
    signedTransactionBase64: signed,
    ...authorization,
  });
  requireLiveWallet(args);
  if (!submitted.ok) throw await refusal(submitted);
  const receipt = await readJson(submitted);
  if (isRecord(receipt) && isRecord(receipt.delegation) && receipt.delegation.status === 'revoked' && typeof receipt.delegation.revokeSignature === 'string' && receipt.delegation.revokedAt) {
    await forgetConfirmedRevocation(args.walletAddress, args.botId);
  }
}

/** Explicit cancellation only: signed intent stops the rule; no transaction is signed.
 * The server prepares Revoke, but the owner may choose that separate action later. */
export async function cancelStoppedBot(args: BotClientInput & { botId: string }): Promise<void> {
  if (!UUID.test(args.botId)) throw new BotClientError('invalid_response');
  const path = `/v1/autopilot/mandates/${args.botId}/revoke`;
  const safety = { ...args, enabled: true };
  const authorization = await issueAndSign({ ...safety, action: 'autopilot_revoke',
    challengePath: `${path}/challenge`, challengeBody: { walletAddress: args.walletAddress } });
  requireLiveWallet(args);
  const response = await post(safety, path, { walletAddress: args.walletAddress, ...authorization });
  requireLiveWallet(args);
  if (!response.ok) throw await refusal(response);
}

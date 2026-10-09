import { Buffer } from 'buffer';
import type {
  RoutineDraft,
  RoutineRecord,
  RoutineStageHolding,
  RoutineStatus,
} from './types';

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type RoutineMessageSigner = (
  message: Uint8Array,
) => Promise<Uint8Array | null>;

type AuthorizationAction = 'stage' | 'list' | 'cancel' | 'approve' | 'execute';

type Challenge = {
  nonce: string;
  expiresAt: string;
  message: Uint8Array;
};

type CommonInput = {
  enabled: boolean;
  walletAddress: string;
  currentWalletAddress: () => string | null | undefined;
  signMessage: RoutineMessageSigner;
  apiBaseUrl?: string | null;
  fetchImpl?: FetchLike;
  now?: () => number;
};

export class RoutineClientError extends Error {
  constructor(readonly code:
    | 'disabled'
    | 'unavailable'
    | 'invalid_response'
    | 'expired'
    | 'declined'
    | 'session_changed') {
    super(
      code === 'disabled'
        ? 'Routines are disabled.'
        : code === 'declined'
          ? 'Routine signing was declined.'
          : code === 'session_changed'
            ? 'Wallet session changed.'
            : 'Routines are temporarily unavailable.',
    );
    this.name = 'RoutineClientError';
  }
}

const ROUTINE_STATUSES = new Set<RoutineStatus>([
  'staged',
  'armed',
  'triggered',
  'approved',
  'executed',
  'declined',
  'expired',
  'canceled',
]);
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSITIVE_DECIMAL = /^\d+(?:\.\d+)?$/;

function baseUrl(input: string | null | undefined): string {
  const value = input?.trim() || process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!value) throw new RoutineClientError('unavailable');
  return value.replace(/\/$/, '');
}

function requireLiveWallet(input: CommonInput): void {
  if (
    !ADDRESS.test(input.walletAddress) ||
    input.currentWalletAddress() !== input.walletAddress
  ) {
    throw new RoutineClientError('session_changed');
  }
}

function canonicalBase64(value: unknown): Uint8Array | null {
  if (
    typeof value !== 'string' ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) return null;
  const decoded = Buffer.from(value, 'base64');
  return decoded.length > 0 && decoded.toString('base64') === value
    ? decoded
    : null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new RoutineClientError('invalid_response');
  }
}

function parseChallenge(
  value: unknown,
  action: AuthorizationAction,
  walletAddress: string,
  now: number,
): Challenge {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RoutineClientError('invalid_response');
  }
  const raw = value as Record<string, unknown>;
  const message = canonicalBase64(raw.messageBase64);
  const expiresAtMs = typeof raw.expiresAt === 'string'
    ? Date.parse(raw.expiresAt)
    : Number.NaN;
  if (
    raw.action !== action ||
    raw.walletAddress !== walletAddress ||
    typeof raw.bindingDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(raw.bindingDigest) ||
    typeof raw.nonce !== 'string' ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(raw.nonce) ||
    !Number.isFinite(expiresAtMs) ||
    message === null
  ) {
    throw new RoutineClientError('invalid_response');
  }
  if (expiresAtMs <= now) throw new RoutineClientError('expired');
  return { nonce: raw.nonce, expiresAt: raw.expiresAt as string, message };
}

async function issueAndSign(args: CommonInput & {
  action: AuthorizationAction;
  challengePath: string;
  challengeBody: Record<string, unknown>;
}): Promise<{ nonce: string; signature: string }> {
  if (!args.enabled) throw new RoutineClientError('disabled');
  requireLiveWallet(args);
  const response = await (args.fetchImpl ?? fetch)(
    `${baseUrl(args.apiBaseUrl)}${args.challengePath}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args.challengeBody),
    },
  ).catch(() => {
    throw new RoutineClientError('unavailable');
  });
  if (!response.ok) throw new RoutineClientError('unavailable');
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
    throw new RoutineClientError('declined');
  }
  if (bytes === null) throw new RoutineClientError('declined');
  if (bytes.length !== 64) throw new RoutineClientError('invalid_response');
  if (Date.parse(challenge.expiresAt) <= (args.now ?? Date.now)()) {
    throw new RoutineClientError('expired');
  }
  requireLiveWallet(args);
  return {
    nonce: challenge.nonce,
    signature: Buffer.from(bytes).toString('base64'),
  };
}

function parseDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function nullableDate(value: unknown): value is string | null {
  return value === null || parseDate(value);
}

function parseRoutine(value: unknown, walletAddress: string): RoutineRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RoutineClientError('invalid_response');
  }
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== 'string' || !UUID.test(raw.id) ||
    raw.walletAddress !== walletAddress ||
    typeof raw.sourceText !== 'string' || raw.sourceText.trim() === '' ||
    raw.kind !== 'exit' ||
    typeof raw.positionMint !== 'string' || !ADDRESS.test(raw.positionMint) ||
    typeof raw.positionSymbol !== 'string' || raw.positionSymbol.length === 0 || raw.positionSymbol.length > 32 ||
    typeof raw.baselinePriceUsd !== 'string' || !POSITIVE_DECIMAL.test(raw.baselinePriceUsd) || Number(raw.baselinePriceUsd) <= 0 ||
    typeof raw.upLegPct !== 'string' || !POSITIVE_DECIMAL.test(raw.upLegPct) || Number(raw.upLegPct) <= 0 ||
    typeof raw.downLegPct !== 'string' || !POSITIVE_DECIMAL.test(raw.downLegPct) || Number(raw.downLegPct) <= 0 || Number(raw.downLegPct) > 100 ||
    !['all', 'fraction', 'usd', 'absolute'].includes(String(raw.amountKind)) ||
    !(raw.amountValue === null || (typeof raw.amountValue === 'string' && POSITIVE_DECIMAL.test(raw.amountValue) && Number(raw.amountValue) > 0)) ||
    typeof raw.status !== 'string' || !ROUTINE_STATUSES.has(raw.status as RoutineStatus) ||
    !parseDate(raw.baselineAt) || !nullableDate(raw.triggeredAt) ||
    !(raw.triggeredLeg === null || raw.triggeredLeg === 'up' || raw.triggeredLeg === 'down') ||
    !(raw.triggeredPriceUsd === null || (typeof raw.triggeredPriceUsd === 'string' && POSITIVE_DECIMAL.test(raw.triggeredPriceUsd))) ||
    !nullableDate(raw.approvedAt) ||
    !(raw.approvingStepUpSessionId === null || typeof raw.approvingStepUpSessionId === 'string') ||
    !(raw.executedSwapSignature === null || typeof raw.executedSwapSignature === 'string') ||
    !parseDate(raw.expiresAt) || !parseDate(raw.createdAt) || !parseDate(raw.updatedAt)
  ) {
    throw new RoutineClientError('invalid_response');
  }
  if (
    (raw.amountKind === 'all' && raw.amountValue !== null) ||
    (raw.amountKind !== 'all' && raw.amountValue === null)
  ) throw new RoutineClientError('invalid_response');
  return raw as RoutineRecord;
}

async function parseRoutineResponse(
  response: Response,
  walletAddress: string,
): Promise<RoutineRecord> {
  if (!response.ok) throw new RoutineClientError('unavailable');
  const body = await readJson(response);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new RoutineClientError('invalid_response');
  }
  return parseRoutine((body as Record<string, unknown>).routine, walletAddress);
}

export async function stageRoutine(args: CommonInput & {
  draft: RoutineDraft;
  holdings: RoutineStageHolding[];
}): Promise<RoutineRecord> {
  const auth = await issueAndSign({
    ...args,
    action: 'stage',
    challengePath: '/v1/routines/challenge',
    challengeBody: { ...args.draft, walletAddress: args.walletAddress },
  });
  const response = await (args.fetchImpl ?? fetch)(
    `${baseUrl(args.apiBaseUrl)}/v1/routines`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...args.draft,
        walletAddress: args.walletAddress,
        holdings: args.holdings,
        ...auth,
      }),
    },
  ).catch(() => {
    throw new RoutineClientError('unavailable');
  });
  requireLiveWallet(args);
  const routine = await parseRoutineResponse(response, args.walletAddress);
  requireLiveWallet(args);
  if (routine.status !== 'armed') {
    throw new RoutineClientError('invalid_response');
  }
  return routine;
}

export async function listRoutines(args: CommonInput): Promise<RoutineRecord[]> {
  const auth = await issueAndSign({
    ...args,
    action: 'list',
    challengePath: '/v1/routines/list/challenge',
    challengeBody: { walletAddress: args.walletAddress },
  });
  const response = await (args.fetchImpl ?? fetch)(
    `${baseUrl(args.apiBaseUrl)}/v1/routines?walletAddress=${encodeURIComponent(args.walletAddress)}`,
    {
      method: 'GET',
      headers: {
        'x-corso-routine-nonce': auth.nonce,
        'x-corso-routine-signature': auth.signature,
      },
    },
  ).catch(() => {
    throw new RoutineClientError('unavailable');
  });
  requireLiveWallet(args);
  if (!response.ok) throw new RoutineClientError('unavailable');
  const body = await readJson(response);
  const values = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>).routines
    : null;
  if (!Array.isArray(values)) throw new RoutineClientError('invalid_response');
  const routines = values.map((value) => parseRoutine(value, args.walletAddress));
  requireLiveWallet(args);
  return routines;
}

export async function cancelRoutine(args: CommonInput & {
  routineId: string;
}): Promise<RoutineRecord> {
  if (!UUID.test(args.routineId)) throw new RoutineClientError('unavailable');
  const path = `/v1/routines/${args.routineId}/cancel`;
  const auth = await issueAndSign({
    ...args,
    action: 'cancel',
    challengePath: `${path}/challenge`,
    challengeBody: { walletAddress: args.walletAddress },
  });
  const response = await (args.fetchImpl ?? fetch)(
    `${baseUrl(args.apiBaseUrl)}${path}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ walletAddress: args.walletAddress, ...auth }),
    },
  ).catch(() => {
    throw new RoutineClientError('unavailable');
  });
  requireLiveWallet(args);
  const routine = await parseRoutineResponse(response, args.walletAddress);
  requireLiveWallet(args);
  return routine;
}

async function authorizeTransition(args: CommonInput & {
  routineId: string;
  action: 'approve' | 'execute';
  body: Record<string, unknown>;
}): Promise<RoutineRecord> {
  const path = `/v1/routines/${args.routineId}/${args.action}`;
  const challengeBody = { walletAddress: args.walletAddress, ...args.body };
  const auth = await issueAndSign({
    ...args,
    action: args.action,
    challengePath: `${path}/challenge`,
    challengeBody,
  });
  const response = await (args.fetchImpl ?? fetch)(
    `${baseUrl(args.apiBaseUrl)}${path}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...challengeBody, ...auth }),
    },
  ).catch(() => {
    throw new RoutineClientError('unavailable');
  });
  requireLiveWallet(args);
  const routine = await parseRoutineResponse(response, args.walletAddress);
  requireLiveWallet(args);
  return routine;
}

export async function recordRoutineFire(args: CommonInput & {
  routineId: string;
  approvingStepUpSessionId: string;
  executedSwapSignature: string;
}): Promise<RoutineRecord> {
  if (!UUID.test(args.routineId)) throw new RoutineClientError('unavailable');
  await authorizeTransition({
    ...args,
    action: 'approve',
    body: {
      approvingStepUpSessionId: args.approvingStepUpSessionId,
      executedSwapSignature: args.executedSwapSignature,
    },
  });
  return authorizeTransition({ ...args, action: 'execute', body: {} });
}

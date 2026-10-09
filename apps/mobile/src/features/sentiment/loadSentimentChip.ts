import { resolveLunarcrushEnabled } from '@/src/lib/apiConfig';
import {
  presentSentimentChip,
  SENTIMENT_ATTRIBUTION,
  type SentimentChipModel,
  type SentimentReady,
} from '@/src/features/sentiment/sentimentChipModel';

const CLIENT_TTL_MS = 60_000;
const SYMBOL_RE = /^[A-Za-z0-9]{1,20}$/;

type CacheEntry = {
  body: SentimentReady | null;
  storedAtMs: number;
};

export class SentimentClientCache {
  private readonly entries = new Map<string, CacheEntry>();

  get(mint: string, symbol: string, nowMs: number): CacheEntry | null {
    const entry = this.entries.get(this.key(mint, symbol));
    if (!entry) return null;
    if (nowMs < entry.storedAtMs || nowMs - entry.storedAtMs > CLIENT_TTL_MS) {
      this.entries.delete(this.key(mint, symbol));
      return null;
    }
    return entry;
  }

  set(
    mint: string,
    symbol: string,
    body: SentimentReady | null,
    storedAtMs: number,
  ): void {
    this.entries.set(this.key(mint, symbol), { body, storedAtMs });
  }

  private key(mint: string, symbol: string): string {
    return `${mint}\n${symbol}`;
  }
}

const sharedCache = new SentimentClientCache();

export type LoadSentimentChipArgs = {
  mint: string;
  symbol: string;
  nowMs?: number;
  enabled?: boolean;
  resolveEnabled?: () => Promise<boolean>;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
  signal?: AbortSignal;
  cache?: SentimentClientCache;
};

function apiBase(override?: string | null): string | null {
  if (override !== undefined) {
    if (override === null) return null;
    const trimmed = override.trim();
    return trimmed.length > 0 ? trimmed.replace(/\/$/, '') : null;
  }
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isAbort(error: unknown, signal: AbortSignal | undefined): boolean {
  if (signal?.aborted) return true;
  return error instanceof Error && error.name === 'AbortError';
}

export function parseSentimentReady(body: unknown): SentimentReady | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (record.status !== 'ready') return null;
  if (record.attribution !== SENTIMENT_ATTRIBUTION) return null;
  const galaxyScore = finite(record.galaxyScore);
  const altRank = finite(record.altRank);
  const sentiment = finite(record.sentiment);
  const socialVolume = finite(record.socialVolume);
  const fetchedAtMs = finite(record.fetchedAtMs);
  const generatedAtMs = finite(record.generatedAtMs);
  if (
    galaxyScore == null ||
    altRank == null ||
    sentiment == null ||
    socialVolume == null ||
    fetchedAtMs == null ||
    generatedAtMs == null ||
    typeof record.mint !== 'string' ||
    typeof record.symbol !== 'string'
  ) {
    return null;
  }
  return {
    status: 'ready',
    mint: record.mint,
    symbol: record.symbol,
    galaxyScore,
    altRank,
    sentiment,
    socialVolume,
    fetchedAtMs,
    generatedAtMs,
    attribution: SENTIMENT_ATTRIBUTION,
  };
}

export async function loadSentimentChip(
  args: LoadSentimentChipArgs,
): Promise<SentimentChipModel> {
  const nowMs = args.nowMs ?? Date.now();
  const symbol = args.symbol.trim();
  if (!SYMBOL_RE.test(symbol) || args.mint.trim().length === 0) {
    return { kind: 'hidden' };
  }
  const enabled =
    args.enabled ?? (await (args.resolveEnabled ?? resolveLunarcrushEnabled)());
  if (!enabled) return { kind: 'hidden' };

  const cache = args.cache ?? sharedCache;
  const cached = cache.get(args.mint, symbol, nowMs);
  if (cached) return presentSentimentChip(cached.body, nowMs);

  const base = apiBase(args.apiBaseUrl);
  if (!base) return { kind: 'hidden' };
  const url = `${base}/v1/tokens/${encodeURIComponent(args.mint)}/sentiment?${new URLSearchParams({ symbol }).toString()}`;
  const fetchImpl = args.fetchImpl ?? globalThis.fetch;
  let parsed: SentimentReady | null = null;
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      signal: args.signal,
      headers: { accept: 'application/json' },
    });
    if (args.signal?.aborted) return { kind: 'hidden' };
    if (response.ok) parsed = parseSentimentReady(await response.json());
  } catch (error) {
    if (isAbort(error, args.signal)) return { kind: 'hidden' };
    parsed = null;
  }
  if (args.signal?.aborted) return { kind: 'hidden' };
  cache.set(args.mint, symbol, parsed, nowMs);
  return presentSentimentChip(parsed, nowMs);
}

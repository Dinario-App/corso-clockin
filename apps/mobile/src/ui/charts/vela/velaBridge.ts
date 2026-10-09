export const VELA_BRIDGE_PROTOCOL_VERSION = 1 as const;

/** Candle as delivered by `/v1/chart-bundle` — decimal strings, no float drift. */
export type VelaCandle = {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
};

export type VelaThemeMode = 'light' | 'dark';

export const VELA_TIMEFRAMES = ['1m', '5m', '1H', '4H', '1D'] as const;
export type VelaTimeframe = (typeof VELA_TIMEFRAMES)[number];

export type VelaBackend = 'webgl2' | 'canvas2d' | 'unknown';

/** Backend-precomputed overlays (mirror of the API `ChartBundleOverlays`). */
export type VelaOverlays = {
  orderBlocks: Array<{
    top: string;
    bottom: string;
    side: 'bull' | 'bear';
    barMs: number;
  }>;
  fvg: Array<{ top: string; bottom: string; filled: boolean; barMs: number }>;
  liquidity: Array<{
    level: string;
    kind: 'eqh' | 'eql' | 'sweep';
    barMs: number;
  }>;
  premiumDiscount?: { premium: string; equilibrium: string; discount: string };
  structure: Array<{
    label: 'CHoCH' | 'CHoCH+' | 'BOS';
    direction: 'bull' | 'bear';
    barMs: number;
    price: string;
  }>;
};

/** RN → WebView (host drives the chart). */
export type VelaHostMessage =
  | {
      t: 'init';
      theme: VelaThemeMode;
      timeframe: VelaTimeframe;
      candles: VelaCandle[];
      overlays: VelaOverlays;
    }
  | { t: 'append'; candle: VelaCandle }
  | { t: 'setRange'; range: { fromMs: number; toMs: number } }
  | { t: 'overlays'; overlays: VelaOverlays }
  | { t: 'theme'; mode: VelaThemeMode };

/** WebView → RN (chart reports interactions/telemetry). */
export type VelaChartMessage =
  /** Bundle loaded + glue installed; the host answers with `init`. */
  | { t: 'ready'; backend?: VelaBackend; vendor?: string }
  /** `init`/`overlays` painted: how many bars and overlay drawings landed. */
  | { t: 'painted'; bars: number; overlays: number; backend?: VelaBackend }
  | { t: 'select'; barMs: number; price: string }
  | { t: 'drawing'; record: unknown }
  | { t: 'error'; detail: string }
  | { t: 'perf'; fps: number; backend?: VelaBackend };

const HOST_TAGS = new Set<VelaHostMessage['t']>([
  'init',
  'append',
  'setRange',
  'overlays',
  'theme',
]);

const CHART_TAGS = new Set<VelaChartMessage['t']>([
  'ready',
  'painted',
  'select',
  'drawing',
  'error',
  'perf',
]);

/** Serialize a host→chart message for `webViewRef.postMessage(...)`. */
export function encodeHostMessage(message: VelaHostMessage): string {
  return JSON.stringify(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const BACKENDS = new Set<VelaBackend>(['webgl2', 'canvas2d', 'unknown']);

/** Optional backend field: present only when the page sent a known value. */
function readBackend(value: unknown): { backend?: VelaBackend } {
  return typeof value === 'string' && BACKENDS.has(value as VelaBackend)
    ? { backend: value as VelaBackend }
    : {};
}

/**
 * Parse and validate a raw `onMessage` string from the WebView into a typed
 * `VelaChartMessage`. Returns `null` for anything malformed — the caller must
 * never trust an unparsed payload (the WebView is a rendering surface, not an
 * authority).
 */
export function parseChartMessage(raw: string): VelaChartMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const tag = parsed.t;
  if (
    typeof tag !== 'string' ||
    !CHART_TAGS.has(tag as VelaChartMessage['t'])
  ) {
    return null;
  }
  switch (tag) {
    case 'ready':
      return {
        t: 'ready',
        ...readBackend(parsed.backend),
        ...(typeof parsed.vendor === 'string' ? { vendor: parsed.vendor } : {}),
      };
    case 'painted':
      if (
        typeof parsed.bars !== 'number' ||
        typeof parsed.overlays !== 'number'
      ) {
        return null;
      }
      return {
        t: 'painted',
        bars: parsed.bars,
        overlays: parsed.overlays,
        ...readBackend(parsed.backend),
      };
    case 'select':
      if (
        typeof parsed.barMs !== 'number' ||
        typeof parsed.price !== 'string'
      ) {
        return null;
      }
      return { t: 'select', barMs: parsed.barMs, price: parsed.price };
    case 'drawing':
      return { t: 'drawing', record: parsed.record };
    case 'error':
      if (typeof parsed.detail !== 'string') return null;
      return { t: 'error', detail: parsed.detail };
    case 'perf':
      if (typeof parsed.fps !== 'number' || !Number.isFinite(parsed.fps))
        return null;
      return { t: 'perf', fps: parsed.fps, ...readBackend(parsed.backend) };
    default:
      return null;
  }
}

/** Narrow a decoded object to a host message (used by the WebView-side glue). */
export function isHostMessage(value: unknown): value is VelaHostMessage {
  return (
    isRecord(value) &&
    typeof value.t === 'string' &&
    HOST_TAGS.has(value.t as VelaHostMessage['t'])
  );
}

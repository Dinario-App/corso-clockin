/**
 * Visual system for this app. "Ethena" is an internal code name, not the
 * Ethena protocol.
 */
import {
  accent as grokAccent,
  marketCaution as marketCautionAmber,
  IOS_GLASS_STROKE_ALPHA,
} from '@/constants/theme';

const accentInCardAction = grokAccent.inCardAction;

/* ─── The five measured tokens ────────────────────────────────────────────── */

export const VOID = '#060606';

export const TRAY_MEASURED = '#0E1012';

export const TRAY = 'rgba(166, 206, 246, 0.05)';

export const CREST = '#12171E';

/** The brushed top-right highlight's hue. Low alpha only — a light source. */
export const CREST_RGB = '108, 140, 190';

export const ICY_1 = '#A9C9F9';
/** ...to y=1290 (bottom). The visual system's only saturated fill. */
export const ICY_2 = '#7F96BA';
/** The label on the icy pill reads near-black. */
export const ON_ICY = '#0A0F17';

export const MUTE = '#A9B3C2';

/* ─── Derived, and flagged as derived ─────────────────────────────────────── */

export const HAIR = 'rgba(255, 255, 255, 0.055)';

/** The `MUTE` hue carried to cool ink's existing ink-3 luminance. */
export const INK_3 = '#7C8697';

/* ─── Material · the floating plane only ──────────────────────────────────── */

const ICY_1_AT_26 = 'rgba(169, 201, 249, 0.26)';

export const ethenaMaterial = {
  float: 'rgba(35, 41, 51, 0.78)',
  float2: 'rgba(23, 27, 34, 0.92)',
  frost: 'rgba(20, 24, 32, 0.72)',
  v2: 'rgba(255, 255, 255, 0.090)',
  /** The selected state of a control on a float. */
  v3: 'rgba(255, 255, 255, 0.200)',
  rim: 'rgba(255, 255, 255, 0.10)',
  /** ☞ ETHENA tray hairline. */
  rimHair: 'rgba(255, 255, 255, 0.045)',
  /**
   * The cool ring worn by the one control that summons a float. `ICY_1` at
   * 26% — cool enough to name the Ask family, nowhere near a fill.
   */
  summonRing: ICY_1_AT_26,
  icyGlass: ICY_1_AT_26,
  icyInner: 'rgba(255, 255, 255, 0.35)',
  blur: 24,
  frostBlur: 40,
} as const;

/**
 * A float tint composited over the void: the opaque colour a float surface
 * shows wherever nothing refracts behind it (the glass's solid engine paints
 * exactly this, tint on a void underlay). Derived from the two tokens above,
 * never a third literal. `float` is `rgb(29, 33, 41)`, which the 369 dp frame
 * of the Find a token sheet measures as (29, 34, 42).
 */
export function ethenaFloatSurface(tint: 'float' | 'float2' | 'frost'): string {
  const parts = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(
    ethenaMaterial[tint],
  );
  const under = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(VOID);
  if (!parts || !under) throw new Error('Unreadable float tint or void token');
  const alpha = Number(parts[4]);
  const over = (index: 1 | 2 | 3) =>
    Math.round(
      Number(parts[index]) * alpha +
        Number.parseInt(under[index]!, 16) * (1 - alpha),
    );
  return `rgb(${over(1)}, ${over(2)}, ${over(3)})`;
}

/* ─── Ink ladder, cooled ──────────────────────────────────────────────────── */

export const ethenaInk = {
  primary: '#FFFFFF',
  /** ☞ ETHENA — the secondary step is the measured cool `MUTE`. */
  secondary: MUTE,
  tertiary: INK_3,
  onIcy: ON_ICY,
} as const;

/* ─── Ground ──────────────────────────────────────────────────────────────── */

export const ETHENA_GROUND_STOPS: readonly (readonly [number, string])[] = [
  [0.0, '#12171E'],
  [0.025, '#11161D'],
  [0.0475, '#10151C'],
  [0.07, '#10141A'],
  [0.0925, '#0F1218'],
  [0.116, '#0E1116'],
  [0.139, '#0D1014'],
  [0.161, '#0D0F12'],
  [0.184, '#0C0D10'],
  [0.206, '#0B0C0F'],
  [0.229, '#0A0B0D'],
  [0.251, '#090A0B'],
  [0.274, '#080809'],
  [0.2975, '#070708'],
  [0.32, VOID],
  [1.0, VOID],
] as const;

/** The brushed top-right highlight. Its existence is measured; its weight (.07)
 *  is a judgement — anything heavier reads as a second surface. */
export const ETHENA_HIGHLIGHT = {
  color: `rgba(${CREST_RGB}, 0.07)`,
  edge: `rgba(${CREST_RGB}, 0)`,
} as const;

export const ETHENA_NOT_STOLEN = ['#00E09B', '#14F08C'] as const;

export const ETHENA_ACCESSIBLE_RIM = `rgba(255, 255, 255, ${IOS_GLASS_STROKE_ALPHA})`;

export const ethena = {
  void: VOID,
  trayMeasured: TRAY_MEASURED,
  tray: TRAY,
  crest: CREST,
  icy1: ICY_1,
  icy2: ICY_2,
  onIcy: ON_ICY,
  mute: MUTE,
  hair: HAIR,
  ink3: INK_3,
  material: ethenaMaterial,
  ink: ethenaInk,
  groundStops: ETHENA_GROUND_STOPS,
  highlight: ETHENA_HIGHLIGHT,
} as const;

export const ethenaAction = accentInCardAction;
export const ethenaCaution = marketCautionAmber;

/* ─── Token marks — the only fills that are not tray, glass or icy ────────── */

export const TOKEN_MARKS: Readonly<Record<string, { bg: string; fg: string }>> =
  {
    usdc: { bg: '#2775CA', fg: '#FFFFFF' },
    btc: { bg: '#F8931A', fg: '#0A0A0A' },
    eth: { bg: '#627EEA', fg: '#FFFFFF' },
    sol: { bg: '#14F195', fg: '#0A0A0A' },
    bonk: { bg: '#F5A623', fg: '#0A0A0A' },
    jup: { bg: '#3FD1C1', fg: '#0A0A0A' },
    none: { bg: 'rgba(255, 255, 255, 0.10)', fg: '#FFFFFF' },
  } as const;

/* ─── The ground's colour at a point ──────────────────────────────────────── */

export type EthenaGradientLayer = {
  colors: readonly string[];
  locations?: readonly number[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
};

type ParsedGradient = {
  stops: { at: number; color: [number, number, number, number] }[];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

const parsedGrounds = new WeakMap<
  readonly EthenaGradientLayer[],
  ParsedGradient[] | null
>();

function parseGround(
  layers: readonly EthenaGradientLayer[],
): ParsedGradient[] | null {
  const parsed: ParsedGradient[] = [];
  for (const layer of layers) {
    const stops: ParsedGradient['stops'] = [];
    for (let i = 0; i < layer.colors.length; i += 1) {
      const value = layer.colors[i]!.trim();
      const hex = /^#([0-9a-f]{6})$/i.exec(value);
      const parts = /^rgba?\(([^)]+)\)$/i.exec(value);
      let color: [number, number, number, number];
      if (hex) {
        const n = Number.parseInt(hex[1]!, 16);
        color = [n >> 16, (n >> 8) & 255, n & 255, 1];
      } else if (parts) {
        const [r, g, b, a = 1] = parts[1]!.split(',').map(Number);
        color = [r!, g!, b!, a];
      } else {
        return null;
      }
      if (!color.every((channel) => Number.isFinite(channel))) return null;
      stops.push({
        at: layer.locations?.[i] ?? i / (layer.colors.length - 1),
        color,
      });
    }
    if (stops.length < 2) return null;
    parsed.push({
      stops,
      start: layer.start ?? { x: 0.5, y: 0 },
      end: layer.end ?? { x: 0.5, y: 1 },
    });
  }
  // The bottom layer must be opaque, or what is under the ground would show.
  if (parsed.length === 0 || parsed[0]!.stops.some((s) => s.color[3] !== 1)) {
    return null;
  }
  return parsed;
}

export function ethenaGroundColorAt(
  layers: readonly EthenaGradientLayer[],
  width: number,
  height: number,
  x: number,
  y: number,
  alpha: number,
): string | null {
  let parsed = parsedGrounds.get(layers);
  if (parsed === undefined) {
    parsed = parseGround(layers);
    parsedGrounds.set(layers, parsed);
  }
  if (parsed === null) return null;
  const rgb = [0, 0, 0];
  for (const layer of parsed) {
    const sx = layer.start.x * width;
    const sy = layer.start.y * height;
    const dx = layer.end.x * width - sx;
    const dy = layer.end.y * height - sy;
    const along = ((x - sx) * dx + (y - sy) * dy) / (dx * dx + dy * dy);
    const t = Math.max(0, Math.min(1, along));
    let next = layer.stops.findIndex((stop, i) => i > 0 && stop.at >= t);
    if (next < 1) next = layer.stops.length - 1;
    const a = layer.stops[next - 1]!;
    const b = layer.stops[next]!;
    const f =
      b.at === a.at ? 1 : Math.max(0, Math.min(1, (t - a.at) / (b.at - a.at)));
    const layerAlpha = a.color[3] + (b.color[3] - a.color[3]) * f;
    for (let i = 0; i < 3; i += 1) {
      const channel = a.color[i]! + (b.color[i]! - a.color[i]!) * f;
      rgb[i] = channel * layerAlpha + rgb[i]! * (1 - layerAlpha);
    }
  }
  return `rgba(${Math.round(rgb[0]!)}, ${Math.round(rgb[1]!)}, ${Math.round(rgb[2]!)}, ${alpha})`;
}

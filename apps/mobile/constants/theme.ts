const INK = '#FFFFFF';
const GREY1 = '#A0A0A0';
const GREY2 = '#8D8D8D';
const GREY3 = '#5E5E5E';

export const IOS_GLASS_STROKE_ALPHA = 0.36;

const SAGE = '#7FB88A';
const DUST = '#D2776B';
const EMBER_AMBER = '#D9A441';

export const colors = {
  ink: INK,
  inkSecondary: GREY1,
  inkTertiary: GREY2,
  inkQuaternary: GREY3,
  line: 'rgba(255, 255, 255, 0.09)',
  /** Strong hairline — bezel, spinner ring, the risk marker's outer ring. */
  surfaceStroke: 'rgba(255, 255, 255, 0.18)',
  /** Inner top light: white @8%. */
  surfaceTopLight: 'rgba(255, 255, 255, 0.08)',
  canvas: '#000000',
  groundSheet: '#111111',
  groundSheetDeep: '#090909',
  surface: '#111111',
  surfaceChip: '#171717',
  surfacePress: '#181818',
  surfaceFloat: '#1F1F1F',
  surfaceRow: '#151417',
  surface2: '#242424',
  surfaceGroup: '#242424',
  surfaceControl: '#2C2C2C',
  surfaceTrack: '#313131',
  surfaceSendOff: '#363636',
  iconRow: '#E4E4E4',
  selected: INK,
  /** Label on a selected (white) fill. */
  onSelected: '#000000',
  toggleOn: '#34C759',
  toggleOff: '#5B5A60',
  grabber: 'rgba(255, 255, 255, 0.32)',
  muted: GREY2,
  /** Sage — gains and the Clear verdict only (carve-out). */
  priceUp: SAGE,
  /** Dust — losses and the Avoid verdict only (carve-out). */
  priceDown: DUST,
  /** Provider-backed token-safety danger only (carve-out). */
  riskDanger: EMBER_AMBER,
  destructive: '#DD6E76',
  /** Glyph / label on a `destructive` fill. */
  onDestructive: '#1F0709',
  /** Inactive navigation label. It carries text, so it uses body copy (`muted`). */
  navInactive: GREY2,
  /** Glass fills, pointed at the current ink ladder. */
  glassFill: 'rgba(255, 255, 255, 0.08)',
  glassStroke: 'rgba(255, 255, 255, 0.10)',
  glassFillPressed: '#181818',
  glassStrokePressed: 'rgba(255, 255, 255, 0.16)',
  glassFillDisabled: '#1F1F1F',
  glassStrokeDisabled: 'rgba(255, 255, 255, 0.08)',
  glassFillSelected: 'rgba(255, 255, 255, 0.18)',
  /** Solid sheet — opaque, so a signing surface never shows the rows behind it. */
  glassFillSheet: '#111111',
  glassStrokeSheet: 'rgba(255, 255, 255, 0.10)',
  /** Sheet scrim — black, an overlay operator, never a surface. */
  scrim: '#000000',
  primaryPressed: 'rgba(255, 255, 255, 0.82)',
  primaryDisabled: '#1F1F1F',
  primaryDisabledLabel: GREY2,
  askSendNested: 'rgba(255, 255, 255, 0.16)',
} as const;

export const marketCaution = EMBER_AMBER;

export const safetyPalette = Object.freeze({
  /** Clear — nothing the reads could find. */
  clear: SAGE,
  /** Caution — a provider-backed warning. */
  caution: EMBER_AMBER,
  /** Danger — a provider-backed danger flag. */
  danger: DUST,
  /** No opinion: read, and nothing to say. */
  neutral: GREY2,
} as const);

export type SafetyPaletteTone = keyof typeof safetyPalette;

const AZURE = '#2FA5FF';

export const accent = {
  /**
   * Ink token. The money CTA does not read it — armed paint is CorsoGlass
   * `icy-cta`. Composer send and the chart line stay this white.
   */
  actionPrimary: INK,
  actionPrimaryPressed: 'rgba(255, 255, 255, 0.82)',
  actionPrimaryDisabled: '#1F1F1F',
  onActionPrimary: '#000000',
  onActionPrimaryDisabled: GREY2,
  actionPrimaryGlow: 'transparent',
  /** Speak pill and send circle — white, always. */
  composeSend: INK,
  onComposeSend: '#000000',
  chartLine: INK,
  brandCursor: AZURE,
  inCardAction: AZURE,
  /** The armed slide-to-sign knob: "you are signing". */
  signArmed: AZURE,
  signArmedTrail: 'rgba(47, 165, 255, 0.28)',
  onSignArmed: '#06131F',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  smd: 12,
  md: 16,
  lg: 24,
  xl: 32,
  gutter: 22,
  dock: 14,
} as const;

export const radii = {
  xs: 4,
  /** Brand mark. */
  brand: 7,
  sm: 8,
  /** Small icon wells — 30px squares. */
  iconWell: 10,
  /** Menu rows. The floor for an interactive text row. */
  menuRow: 12,
  /** Icon wells at 34–38px. */
  iconWellLarge: 12,
  /** Model-picker rows. */
  modelRow: 14,
  selector: 14,
  md: 16,
  chip: 16,
  row: 16,
  /** Small panes: the bot strip, the attach popover. */
  smallPane: 18,
  group: 18,
  pane: 22,
  hold: 22,
  verdict: 22,
  lg: 24,
  card: 22,
  composer: 28,
  sheet: 38,
  cta: 999,
  pill: 999,
} as const;

export const kitType = {
  amount: 34,
  chartPrice: 28,
  title: 22,
  headline: 17,
  body: 17,
  sub: 15,
  caption: 13,
  tab: 11,
} as const;

export const kitWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  wordmark: '800',
} as const;

export const typography = {
  fontFamily: 'Inter',
  fontFamilyVariable: 'InterVariable',
  fontFamilyBlack: 'Inter-Black',
  fontFamilyMono: 'SpaceMono',
  dollar: 60,
  display: 44,
  hero: 34,
  screenTitle: 30,
  title: 22,
  body: 17,
  caption: 13,
  /** Quiet line under the dollar — Home / Money “you hold this”. */
  hold: 14,
  amount: 32,
  micro: 11,
  mono: 13,
  control: 58,
  ask: 60,
  chip: 38,
  fontVariantTabular: ['tabular-nums'] as const,
  /**
   * OpenType `tnum` + `zero` for Mono/13 — slashed zero on addresses/signatures only.
   * Same Inter family; do not introduce a separate mono font face.
   */
  fontVariantMono: ['tabular-nums', 'slashed-zero'] as const,
  fontVariantNumerals: ['tabular-nums', 'slashed-zero'] as const,
} as const;

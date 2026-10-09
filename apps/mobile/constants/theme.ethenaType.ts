export type TypeStep = {
  readonly fontSize: number;
  readonly lineHeight?: number;
  readonly fontWeight?: '400' | '500' | '600';
  readonly letterSpacing?: number;
};

const LADDER = {
  status: { fontSize: 15, fontWeight: '600' },
  nav: { fontSize: 17 },
  navMid: { fontSize: 17, fontWeight: '600' },
  navTrailing: { fontSize: 18 },
  back: { fontSize: 22, lineHeight: 22 },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '600',
    letterSpacing: -1.02,
  },
  eyebrow: { fontSize: 15, lineHeight: 20 },
  amount: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '600',
    letterSpacing: -1.2,
  },
  amountCents: { fontSize: 26, fontWeight: '600', letterSpacing: -0.52 },
  sub: { fontSize: 15, lineHeight: 20 },
  section: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  sectionTrailing: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  rowName: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.255,
  },
  rowSub: { fontSize: 13, lineHeight: 18 },
  rowValue: { fontSize: 17, lineHeight: 22, fontWeight: '500' },
  rowDelta: { fontSize: 13, lineHeight: 18 },
  keyValue: { fontSize: 15, lineHeight: 20 },
  /** `.kv.tot` — the SAME step at 600. The total closes the card by weight. */
  keyValueTotal: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  keyValueInfo: { fontSize: 12 },
  /** `.wh b` — 17/22/600, -.015em. */
  cardHeading: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.255,
  },
  cardAction: { fontSize: 15, fontWeight: '400' },
  cardCaution: { fontSize: 17 },
  /** `.card p` — 15/20 in ink-2, margin-top 8. */
  body: { fontSize: 15, lineHeight: 20 },
  pill: { fontSize: 17, fontWeight: '500' },
  pillCommit: { fontSize: 17, fontWeight: '600' },
  circle: { fontSize: 18 },
  quickLabel: { fontSize: 13, lineHeight: 17 },
  quickGlyph: { fontSize: 20 },
  quickGlyphForward: { fontSize: 20, fontWeight: '600' },
  dockLabel: { fontSize: 11, lineHeight: 13 },
  dockGlyph: { fontSize: 19, lineHeight: 22 },
  coin: { fontSize: 14, fontWeight: '600' },
} as const satisfies Record<string, TypeStep>;

export const ETHENA_TYPE = {
  ...LADDER,
  sectionSeparating: LADDER.keyValueTotal,
} as const satisfies Record<string, TypeStep>;

/** `.card p` and the kv gap below a body line. */
export const ETHENA_BODY_MARGIN = 8;

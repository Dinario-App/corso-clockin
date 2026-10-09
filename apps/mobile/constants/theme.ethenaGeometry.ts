export const ethenaGeometry = {
  /** card left edge x=48px @3x */
  gutter: 16,
  /** card ink begins x~98px */
  pad: 16,
  /** card-to-card 50-51px @3x, five consecutive gaps */
  gap: 16,
  /** circular fit R=51px on the card corner */
  radiusBox: 16,
  /** circular fit R~72px on the sheet top corner */
  radiusSheet: 24,
  /** 154px @3x — identical on Send, Buy and Buy|Sell. Wait and Sign are peers
   *  BY THIS NUMBER: the peer claim IS the geometry. */
  pillHeight: 51,
  /** 108px @3x — segmented track, amount chips */
  segHeight: 36,
  /** 36px disc + 2x20px padding — allocation-card row */
  rowHeight: 76,
  /** 11px @3x — the budget meter */
  bar: 4,
  dockHeight: 62,
} as const;

export const ETHENA_FRAME = { width: 369, height: 800 } as const;

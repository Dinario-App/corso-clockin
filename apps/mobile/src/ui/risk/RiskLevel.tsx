import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { ethenaInk, HAIR } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import type { PlainRiskRead } from '@/src/features/plainRisk/parsePlainRisk';
import {
  RISK_GLYPH_BARS,
  resolvePlainRiskFace,
  resolvePlainRiskSheet,
  type PlainRiskSheetLine,
  type PlainRiskTone,
} from '@/src/features/plainRisk/plainRiskPresentation';
import { CorsoText } from '@/src/theme/CorsoText';
import { copy } from '@/constants/copy';
import { Skeleton } from '@/src/ui/state/Skeleton';
import {
  EthenaAnchoredMenu,
  type AnchorRect,
} from '@/src/ui/ethena/EthenaAnchoredMenu';
import { MIN_TAP_TARGET_PT } from '@/src/ui/primitives/tapTargetPresentation';
import { safetyPalette } from '@/src/ui/tokens';

export type RiskLevelSize = 'row' | 'cell';

const GLYPH_BOX = { width: 56, height: 16 } as const;
const GLYPH_SCALE: Record<RiskLevelSize, number> = { row: 0.5, cell: 0.75 };
const SHEET_WIDTH = 296;
const SHEET_CHROME_DP = 210;
const SHEET_LINE_DP = 34;
/** The canon's unlit bar opacity (`kit.js`: `opacity="0.3"`). */
const UNLIT_OPACITY = 0.3;

function toneInk(tone: PlainRiskTone): string {
  return tone === 'neutral' ? ethenaInk.tertiary : safetyPalette[tone];
}

export function RiskGlyph({
  litBars,
  tone,
  scale,
}: {
  litBars: number;
  tone: PlainRiskTone;
  scale: number;
}) {
  const lit = toneInk(tone);
  return (
    <Svg
      width={GLYPH_BOX.width * scale}
      height={GLYPH_BOX.height * scale}
      viewBox={`0 0 ${GLYPH_BOX.width} ${GLYPH_BOX.height}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: RISK_GLYPH_BARS }, (_, i) => (
        <Rect
          key={i}
          x={2 + 11 * i}
          y={2.5 + 2 * i}
          width={7}
          height={11 - 2 * i}
          rx={1.5}
          fill={i < litBars ? lit : ethenaInk.tertiary}
          opacity={i < litBars ? 1 : UNLIT_OPACITY}
        />
      ))}
    </Svg>
  );
}

export function RiskLevel({
  read,
  size = 'row',
  clock,
  testID,
}: {
  read: PlainRiskRead;
  size?: RiskLevelSize;
  clock?: '24h' | '12h';
  testID?: string;
}) {
  const face = resolvePlainRiskFace(read);
  const anchorRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [open, setOpen] = useState(false);

  function openSheet() {
    const node = anchorRef.current;
    if (!node) return;
    node.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }

  return (
    <View ref={anchorRef} collapsable={false} testID={testID}>
      <Pressable
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={face.accessibilityLabel}
        hitSlop={size === 'row' ? 13 : 0}
        style={[
          styles.face,
          size === 'cell' ? styles.faceCell : styles.faceRow,
        ]}
      >
        <RiskGlyph
          litBars={face.litBars}
          tone={face.tone}
          scale={GLYPH_SCALE[size]}
        />
        {/* No line cap: at large type the level word wraps, never truncates
            ("Not enough d…" in the 1.3 Markets frame). */}
        <CorsoText
          style={[
            size === 'cell' ? ETHENA_TYPE.cardHeading : ETHENA_TYPE.rowSub,
            {
              color: size === 'cell' ? ethenaInk.primary : ethenaInk.secondary,
              flexShrink: 1,
            },
          ]}
        >
          {face.label}
        </CorsoText>
      </Pressable>
      {size === 'cell' && face.subLine ? (
        <CorsoText style={[ETHENA_TYPE.rowSub, { color: ethenaInk.secondary }]}>
          {face.subLine}
        </CorsoText>
      ) : null}
      {open ? (
        <RiskLevelSheet
          read={read}
          clock={clock}
          anchor={anchor}
          onRequestClose={() => setOpen(false)}
          testID={testID ? `${testID}-sheet` : undefined}
        />
      ) : null}
    </View>
  );
}

/**
 * A list row's risk level. Rows read it with `usePlainRisk(mint)` (one shared
 * reader, so every surface shows the same level for the same mint) and put
 * `spokenRiskLevel(read)` into their own accessibility label, since an
 * accessible row hides what it contains. `null` is the first read in flight:
 * a skeleton. A failure is "Risk unavailable", never a blank, never green.
 */
export function RiskLevelSlot({
  read,
  size = 'row',
  testID,
}: {
  read: PlainRiskRead | null;
  size?: RiskLevelSize;
  testID?: string;
}) {
  if (read == null) {
    return (
      <Skeleton
        what={copy.browse.sort.option.risk}
        width={size === 'row' ? 72 : 120}
        height={size === 'row' ? 12 : 20}
        testID={testID ? `${testID}-loading` : undefined}
      />
    );
  }
  return <RiskLevel read={read} size={size} testID={testID} />;
}

/** The level word for a row's own accessibility label; `null` while loading. */
export function spokenRiskLevel(read: PlainRiskRead | null): string | null {
  return read == null ? null : resolvePlainRiskFace(read).accessibilityLabel;
}

/** What was found reads first: a flag or the issuer line in primary ink. */
function lineInk(state: PlainRiskSheetLine['state']): string {
  return state === 'flagged' || state === 'disclosed'
    ? ethenaInk.primary
    : ethenaInk.secondary;
}

export function RiskLevelSheet({
  read,
  clock,
  anchor,
  onRequestClose,
  testID,
}: {
  read: PlainRiskRead;
  clock?: '24h' | '12h';
  anchor: AnchorRect | null;
  onRequestClose: () => void;
  testID?: string;
}) {
  const face = resolvePlainRiskFace(read);
  const sheet = resolvePlainRiskSheet(read, { clock });
  const { fontScale } = useWindowDimensions();
  return (
    <EthenaAnchoredMenu
      visible
      anchor={anchor}
      width={SHEET_WIDTH}
      estimatedHeight={Math.ceil(
        (SHEET_CHROME_DP + sheet.lines.length * SHEET_LINE_DP) * fontScale,
      )}
      onRequestClose={onRequestClose}
      dismissLabel={copy.askSheet.close}
      contentStyle={styles.sheet}
      testID={testID}
    >
      <View style={styles.sheetHead}>
        <RiskGlyph
          litBars={face.litBars}
          tone={face.tone}
          scale={GLYPH_SCALE.cell}
        />
        <CorsoText
          accessibilityRole="header"
          style={[ETHENA_TYPE.cardHeading, { color: ethenaInk.primary }]}
        >
          {sheet.title}
        </CorsoText>
      </View>
      {sheet.subLine ? (
        <CorsoText style={[ETHENA_TYPE.body, { color: ethenaInk.secondary }]}>
          {sheet.subLine}
        </CorsoText>
      ) : null}
      <CorsoText style={[ETHENA_TYPE.body, { color: ethenaInk.secondary }]}>
        {sheet.scope}
      </CorsoText>
      {sheet.lines.length > 0 ? (
        <View style={styles.lines}>
          {sheet.lines.map((line) => (
            <CorsoText
              key={line.key}
              style={[ETHENA_TYPE.keyValue, { color: lineInk(line.state) }]}
            >
              {line.text}
            </CorsoText>
          ))}
        </View>
      ) : null}
      {sheet.checkedAt ? (
        <CorsoText
          style={[ETHENA_TYPE.keyValueInfo, { color: ethenaInk.secondary }]}
        >
          {sheet.checkedAt}
        </CorsoText>
      ) : null}
    </EthenaAnchoredMenu>
  );
}

const styles = StyleSheet.create({
  face: { flexDirection: 'row', alignItems: 'center', columnGap: 6 },
  /** 18 + 2 × 13 hit slop = the 44 dp floor without growing the row. */
  faceRow: { minHeight: 18 },
  faceCell: { minHeight: MIN_TAP_TARGET_PT },
  sheet: {
    paddingHorizontal: ethenaGeometry.pad,
    paddingVertical: 14,
    rowGap: 8,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  lines: { borderTopWidth: 1, borderTopColor: HAIR, paddingTop: 8, rowGap: 6 },
});

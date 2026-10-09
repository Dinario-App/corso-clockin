import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CorsoText } from '@/src/theme/CorsoText';
import { colors, typography } from '@/src/ui/tokens';
import {
  EVIDENCE_ROW,
  VERDICT_CARD_GEOMETRY as G,
  canonWeight,
  resolveEvidenceRowMarker,
  resolveEvidenceRowText,
  type EvidenceRowMarkShape,
  type VerdictChipTone,
} from './verdictCardPresentation';

export function EvidenceRow({
  label,
  value,
  tone,
  isLast,
}: {
  label: string;
  value?: string | null;
  tone?: VerdictChipTone;
  /** The last row carries no divider; the CTA's gap follows it. */
  isLast: boolean;
}) {
  const text = resolveEvidenceRowText(label, value ?? undefined);
  const marker = resolveEvidenceRowMarker({ tone });
  const spoken =
    text.value === null ? text.label : `${text.label}, ${text.value}`;
  return (
    <View style={styles.row} accessibilityLabel={spoken}>
      <View style={styles.marker}>
        <EvidenceMark shape={marker.shape} color={marker.color} />
      </View>
      <View style={[styles.body, isLast ? null : styles.divider]}>
        <CorsoText style={styles.label} numberOfLines={EVIDENCE_ROW.labelLines}>
          {text.label}
        </CorsoText>
        {text.value === null ? null : (
          <CorsoText
            style={styles.value}
            numberOfLines={EVIDENCE_ROW.valueLines}
          >
            {text.value}
          </CorsoText>
        )}
      </View>
    </View>
  );
}

const MARK_PATH: Readonly<Record<Exclude<EvidenceRowMarkShape, 'dot'>, string>> =
  Object.freeze({
    octagon: 'M4 .5h4l3.5 3.5v4L8 11.5H4L.5 8V4z',
    triangle: 'M6 1.6L11 10.2H1L6 1.6z',
  });

function EvidenceMark({
  shape,
  color,
}: {
  shape: EvidenceRowMarkShape;
  color: string;
}) {
  if (shape === 'dot') {
    return <View style={[styles.dot, { backgroundColor: color }]} />;
  }
  const size = G.evidenceMarkSize;
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12">
      {shape === 'octagon' ? (
        <Path d={MARK_PATH.octagon} fill={color} />
      ) : (
        <Path
          d={MARK_PATH.triangle}
          fill="none"
          stroke={color}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: G.evidenceDotGap,
  },
  marker: {
    width: G.evidenceMarkerWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: EVIDENCE_ROW.dot,
    height: EVIDENCE_ROW.dot,
    borderRadius: EVIDENCE_ROW.dot / 2,
  },
  /** The divider hangs off the text column, so it starts where the label does. */
  body: {
    flex: 1,
    minHeight: EVIDENCE_ROW.height,
    flexDirection: 'row',
    alignItems: 'center',
    gap: G.evidenceValueGap,
    paddingVertical: G.evidencePaddingVertical,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  label: {
    flexShrink: 1,
    fontSize: EVIDENCE_ROW.labelSize,
    lineHeight: EVIDENCE_ROW.lineHeight,
    fontFamily: typography.face(EVIDENCE_ROW.labelWeight),
    fontWeight: canonWeight(EVIDENCE_ROW.labelWeight),
    color: colors.ink,
  },
  value: {
    flexShrink: 0,
    marginLeft: 'auto',
    textAlign: 'right',
    fontSize: EVIDENCE_ROW.valueSize,
    lineHeight: EVIDENCE_ROW.lineHeight,
    fontFamily: typography.face(EVIDENCE_ROW.labelWeight),
    fontWeight: canonWeight(EVIDENCE_ROW.labelWeight),
    color: colors.inkSecondary,
  },
});

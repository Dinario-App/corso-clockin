import { StyleSheet, View } from 'react-native';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import {
  CANON_TYPE_SIZES,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { Material } from '@/src/ui/glass/Material';
import { ONGLASS } from '@/src/ui/glass/materialTokens';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';
import type { ScopeCardModel, ScopeRow } from '../botPresentation';

type Props = {
  model: ScopeCardModel;
  testID?: string;
};

function Row({
  row,
  glyph,
  glyphColor,
  hero,
}: {
  row: ScopeRow;
  glyph: string;
  glyphColor: string;
  hero: boolean;
}) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${glyph} ${row.title}${row.body ? `, ${row.body}` : ''}`}
    >
      <CorsoText
        style={[styles.glyph, { color: glyphColor }]}
        accessible={false}
      >
        {glyph}
      </CorsoText>
      <View style={styles.rowText}>
        <CorsoText
          style={[styles.rowTitle, hero ? styles.rowTitleHero : null]}
          accessible={false}
        >
          {row.title}
        </CorsoText>
        {row.body ? (
          <CorsoText style={styles.rowBody} accessible={false}>
            {row.body}
          </CorsoText>
        ) : null}
      </View>
    </View>
  );
}

export function ScopeCard({ model, testID }: Props) {
  return (
    <Material
      weight="card"
      radius={radii.verdict}
      style={styles.card}
      contentStyle={styles.content}
      testID={testID}
    >
      <View style={styles.top}>
        <CorsoText style={styles.name} accessibilityRole="header">
          {model.name}
        </CorsoText>
        <CorsoText style={styles.tag}>{model.tag}</CorsoText>
      </View>
      <CorsoText style={styles.lede}>{model.lede}</CorsoText>

      <CorsoText style={styles.group}>
        {copy.automation.scope.canHeading}
      </CorsoText>
      {model.can.map((row) => (
        <Row
          key={row.key}
          row={row}
          glyph="✓"
          glyphColor={colors.priceUp}
          hero={false}
        />
      ))}

      <View style={styles.hairline} />

      <View style={styles.never} testID={testID ? `${testID}-chain` : undefined}>
        <CorsoText style={[styles.group, styles.groupHero]}>
          {copy.automation.scope.chainHeading}
        </CorsoText>
        {model.chain.map((row) => (
          <Row key={row.key} row={row} glyph="✓" glyphColor={colors.priceUp} hero />
        ))}
      </View>
      <View style={styles.never} testID={testID ? `${testID}-corso` : undefined}>
        <CorsoText style={[styles.group, styles.groupHero]}>
          {copy.automation.scope.corsoHeading}
        </CorsoText>
        <CorsoText style={styles.note}>{model.corsoNote}</CorsoText>
        {model.corso.map((row) => (
          <Row key={row.key} row={row} glyph="✕" glyphColor={colors.priceDown} hero />
        ))}
      </View>

      <CorsoText style={styles.note}>{model.signsNote}</CorsoText>
      <CorsoText style={styles.note}>{model.killNote}</CorsoText>
    </Material>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16 },
  top: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: 4,
  },
  name: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.verdictWord,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
    letterSpacing: canonTracking(CANON_TYPE_SIZES.verdictWord, -0.02),
  },
  tag: {
    marginLeft: 'auto',
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.micro,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  lede: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.body,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    lineHeight: 19,
    marginBottom: 14,
  },
  group: {
    color: colors.inkTertiary,
    fontSize: 15,
    fontFamily: typography.face('500'),
    fontWeight: '500',
    paddingTop: 6,
    paddingBottom: 4,
  },
  groupHero: { color: colors.ink, paddingTop: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm,
  },
  glyph: {
    width: 16,
    textAlign: 'center',
    paddingTop: 2,
    fontSize: 11,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
    lineHeight: 15,
  },
  rowText: { flex: 1, gap: 1 },
  rowTitle: {
    color: colors.inkSecondary,
    fontSize: CANON_TYPE_SIZES.body,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    lineHeight: 18,
  },
  rowTitleHero: {
    color: colors.ink,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
  },
  rowBody: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.micro,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    lineHeight: 16,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginTop: spacing.sm + 2,
    marginBottom: 6,
  },
  never: {
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 14,
    paddingTop: spacing.smd,
    paddingBottom: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: ONGLASS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  note: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.micro,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    lineHeight: 17,
    marginTop: spacing.smd,
  },
});

import { SuspensionNotice } from './SuspensionNotice';
import type { BotView } from '../types';
import { StyleSheet, View } from 'react-native';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import {
  CANON_TYPE_SIZES,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { Material } from '@/src/ui/glass/Material';
import { ONGLASS, ONGLASS_HI } from '@/src/ui/glass/materialTokens';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';

export type FireReceiptCardProps = {
  /** Up to four characters in the well — the unit the fire spent. */
  mark: string;
  /** The amount the fire spent, already formatted in its unit. */
  amount: string;
  /** `outcome · day time`. */
  meta: string;
  /** The fill line, when the chain has answered. */
  fill: string | null;
  /** A skip is the cap holding, so it reads amber and quiet, never red. */
  skipped: boolean;
  /** The exact charged fee line, formatted from the server fire record. */
  fee?: string;
  testID?: string;
  bot?: BotView;
  onRevoke?: () => void;
  onCancel?: () => void;
};

export function FireReceiptCard(props: FireReceiptCardProps) {
  return (
    <Material
      weight="card"
      radius={radii.pane}
      style={styles.card}
      contentStyle={styles.content}
      testID={props.testID}
    >
      <View style={[styles.well, props.skipped ? styles.wellSkip : null]}>
        <CorsoText style={styles.wellText} numberOfLines={1}>
          {props.mark}
        </CorsoText>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <CorsoText style={styles.amount}>{props.amount}</CorsoText>
          {props.skipped ? (
            <CorsoText style={styles.warnGlyph} accessible={false}>
              {'▲'}
            </CorsoText>
          ) : null}
        </View>
        <CorsoText style={styles.meta} numberOfLines={1}>
          {props.fill ? `${props.meta} · ${props.fill}` : props.meta}
        </CorsoText>
        {props.fee ? (
          <CorsoText style={styles.meta}>{props.fee}</CorsoText>
        ) : null}
      </View>
      {props.bot && props.onRevoke && props.onCancel ? <SuspensionNotice bot={props.bot} busy={false} onRevoke={props.onRevoke} onCancel={props.onCancel} /> : null}
      <View style={styles.stamp}>
        <CorsoText style={styles.stampText}>
          {copy.automation.fires.auto}
        </CorsoText>
      </View>
    </Material>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 10 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smd,
    paddingHorizontal: 14,
    paddingVertical: spacing.smd,
  },
  well: {
    width: 34,
    height: 34,
    borderRadius: radii.iconWellLarge,
    backgroundColor: ONGLASS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wellSkip: { backgroundColor: ONGLASS },
  wellText: {
    color: colors.inkSecondary,
    fontSize: 11,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  amount: {
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.body,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
    letterSpacing: canonTracking(CANON_TYPE_SIZES.body, -0.005),
  },
  warnGlyph: { color: colors.riskDanger, fontSize: 11 },
  meta: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.micro,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    marginTop: 2,
  },
  stamp: {
    borderRadius: radii.pill,
    backgroundColor: ONGLASS_HI,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  stampText: {
    color: colors.inkSecondary,
    fontSize: CANON_TYPE_SIZES.groupLabel,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
    letterSpacing: canonTracking(CANON_TYPE_SIZES.groupLabel, 0.12),
  },
});

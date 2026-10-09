import { StyleSheet, View } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import {
  CANON_TYPE_SIZES,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { GlassPill } from '@/src/ui/controls/GlassPill';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { Material } from '@/src/ui/glass/Material';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';
import {
  buildRoutineReviewPresentation,
  routineStatusLabel,
} from './routinePresentation';
import type { RoutineDraft, RoutineRecord } from './types';

type Props = {
  status: 'loading' | 'ready' | 'error';
  routines: RoutineRecord[];
  busyRoutineId: string | null;
  error: string | null;
  onReview: (routine: RoutineRecord) => void;
  onCancel: (routine: RoutineRecord) => void;
  armingOpen: boolean;
};

function asDraft(routine: RoutineRecord): RoutineDraft {
  return {
    sourceText: routine.sourceText,
    kind: routine.kind,
    positionMint: routine.positionMint,
    positionSymbol: routine.positionSymbol,
    baselinePriceUsd: Number(routine.baselinePriceUsd),
    upLegPct: Number(routine.upLegPct),
    downLegPct: Number(routine.downLegPct),
    amountKind: routine.amountKind,
    amountValue:
      routine.amountValue === null ? null : Number(routine.amountValue),
  };
}

export function RoutinesMoneySection(props: Props) {
  return (
    <View style={styles.section}>
      <CorsoText style={styles.heading}>Routines</CorsoText>
      {props.status === 'loading' ? (
        <CorsoText style={styles.note}>Checking your routines…</CorsoText>
      ) : null}
      {props.status === 'ready' && props.routines.length === 0 ? (
        <CorsoText style={styles.note}>No routines staged.</CorsoText>
      ) : null}
      {props.error ? (
        <CorsoText style={styles.note}>{props.error}</CorsoText>
      ) : null}
      {props.routines.map((routine) => {
        const model = buildRoutineReviewPresentation(asDraft(routine));
        const busy = props.busyRoutineId === routine.id;
        const cancellable = ['staged', 'armed', 'triggered'].includes(
          routine.status,
        );
        return (
          <Material
            key={routine.id}
            weight="card"
            radius={radii.pane}
            contentStyle={styles.card}
          >
            <View style={styles.topline}>
              <CorsoText style={styles.symbol}>{model.position}</CorsoText>
              <CorsoText style={styles.status}>
                {routineStatusLabel(routine.status, props.armingOpen)}
              </CorsoText>
            </View>
            <CorsoText style={styles.detail}>
              {model.upperLeg} / {model.lowerLeg}
            </CorsoText>
            <CorsoText style={styles.detail}>{model.amount}</CorsoText>
            {routine.status === 'triggered' ? (
              <PrimaryCTA
                label="Review sell"
                busy={busy}
                disabled={busy}
                onPress={() => props.onReview(routine)}
              />
            ) : null}
            {cancellable ? (
              <GlassPill
                label="Cancel routine"
                disabled={busy}
                onPress={() => props.onCancel(routine)}
              />
            ) : null}
          </Material>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl, gap: spacing.sm },
  heading: {
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.identity,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
    letterSpacing: canonTracking(CANON_TYPE_SIZES.identity, -0.015),
  },
  note: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.body,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  card: { padding: spacing.md, gap: spacing.sm },
  topline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  symbol: {
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.cardTitle,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
    letterSpacing: canonTracking(CANON_TYPE_SIZES.cardTitle, -0.01),
  },
  status: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.meta,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
    textTransform: 'capitalize',
  },
  detail: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.micro,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
});

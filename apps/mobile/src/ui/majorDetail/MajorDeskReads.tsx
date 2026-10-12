import { View } from 'react-native';
import { ethena } from '@/constants/theme.ethena';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import type { PlainRiskRead } from '@/src/features/plainRisk/parsePlainRisk';
import {
  DESK_RISK_LABEL,
  type DeskMoodLine,
  type DeskReadCell,
  type MajorDeskReads as MajorDeskReadsModel,
} from '@/src/features/tokenDesk/majorDeskReads';
import { CorsoText } from '@/src/theme/CorsoText';
import { EthenaTray } from '@/src/ui/ethena/EthenaPrimitives';
import { resolvePlainRiskFace } from '@/src/features/plainRisk/plainRiskPresentation';
import { MIN_TAP_TARGET_PT } from '@/src/ui/primitives/tapTargetPresentation';
import { RiskLevelSlot } from '@/src/ui/risk/RiskLevel';
import { readWealthV1BuildFlag } from '@/src/features/wealth/wealthEnv';

export function MajorDeskReads({
  model,
  risk,
}: {
  model: MajorDeskReadsModel;
  risk: PlainRiskRead | null;
}) {
  const rows: DeskReadCell[][] = [];
  for (let i = 0; i < model.cells.length; i += 2) {
    rows.push(model.cells.slice(i, i + 2));
  }
  return (
    <View testID="major-desk-reads" style={STACK}>
      <RiskTray read={risk} />
      {rows.map((row) => (
        <View key={row.map((c) => c.key).join('-')} style={ROW}>
          {row.map((c) => (
            <ReadTile key={c.key} cell={c} />
          ))}
          {row.length === 1 ? <View style={TILE_SLOT} /> : null}
        </View>
      ))}
      <MoodTray mood={model.mood} />
    </View>
  );
}

function ReadTile({ cell }: { cell: DeskReadCell }) {
  const wealthV1 = readWealthV1BuildFlag();
  return (
    <View style={TILE_SLOT}>
      <EthenaTray testID={`major-desk-read-${cell.key}`} style={CELL_TILE}>
        <View
          accessible
          accessibilityLabel={cell.accessibilityLabel}
          style={BODY}
        >
          <CorsoText style={LABEL} numberOfLines={wealthV1 ? 2 : 1}>
            {cell.label}
          </CorsoText>
          <CorsoText
            style={cell.state === 'ready' ? VALUE : VALUE_QUIET}
            numberOfLines={2}
          >
            {cell.value}
          </CorsoText>
          {/* The stamp line is held while a read is out, so the block does not grow when it lands. */}
          <CorsoText style={STAMP} numberOfLines={1}>
            {cell.stamp ?? HELD_LINE}
          </CorsoText>
        </View>
      </EthenaTray>
    </View>
  );
}

function RiskTray({ read }: { read: PlainRiskRead | null }) {
  const holdsLine = read == null || resolvePlainRiskFace(read).subLine == null;
  return (
    <EthenaTray testID="major-desk-read-risk" style={TILE}>
      <View style={BODY}>
        <CorsoText style={LABEL} numberOfLines={1}>
          {DESK_RISK_LABEL}
        </CorsoText>
        {/* One block, no gap: the held line sits where the green line does. */}
        <View>
          <View style={read == null ? RISK_ROW_HELD : null}>
            <RiskLevelSlot
              read={read}
              size="cell"
              testID="major-desk-risk-level"
            />
          </View>
          {holdsLine ? (
            <CorsoText style={STAMP} numberOfLines={1}>
              {HELD_LINE}
            </CorsoText>
          ) : null}
        </View>
      </View>
    </EthenaTray>
  );
}

function MoodTray({ mood }: { mood: DeskMoodLine }) {
  return (
    <EthenaTray testID="major-desk-read-mood" style={TILE}>
      <View
        accessible
        accessibilityLabel={mood.accessibilityLabel}
        style={BODY}
      >
        <CorsoText
          style={mood.state === 'ready' ? VALUE : VALUE_QUIET}
          numberOfLines={2}
        >
          {mood.value}
        </CorsoText>
        <CorsoText style={STAMP} numberOfLines={1}>
          {mood.stamp ?? HELD_LINE}
        </CorsoText>
      </View>
    </EthenaTray>
  );
}

/** A no-break space: an empty stamp line that keeps its height. */
const HELD_LINE = '\u00A0';
/** Tabular figures, the Ethena way (`MajorDetailStatGrid`). */
const TABULAR: ['tabular-nums'] = ['tabular-nums'];
/** The face's own rhythm: its ScrollView stacks at 12. */
const STACK = { gap: 12 } as const;
const ROW = { flexDirection: 'row', gap: 12 } as const;
const TILE_SLOT = { flex: 1, minWidth: 0 } as const;
/** The share tray's vertical rhythm (`MajorDetailFace`, `paddingVertical: 14`). */
const TILE = { paddingVertical: 14 } as const;
/** A cell fills its row, so a wrapped neighbour never leaves it short. */
const CELL_TILE = { ...TILE, flexGrow: 1 } as const;
const BODY = { gap: 4 } as const;
/** The skeleton stands in the level row's own 44 dp (`RiskLevel` `faceCell`). */
const RISK_ROW_HELD = {
  minHeight: MIN_TAP_TARGET_PT,
  justifyContent: 'center',
} as const;
const LABEL = { ...ETHENA_TYPE.eyebrow, color: ethena.ink.tertiary };
const VALUE = {
  ...ETHENA_TYPE.rowValue,
  color: ethena.ink.primary,
  fontVariant: TABULAR,
};
const VALUE_QUIET = { ...ETHENA_TYPE.rowValue, color: ethena.ink.secondary };
const STAMP = {
  ...ETHENA_TYPE.rowSub,
  color: ethena.ink.tertiary,
  fontVariant: TABULAR,
};

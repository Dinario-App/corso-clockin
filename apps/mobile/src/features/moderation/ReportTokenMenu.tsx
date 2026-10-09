import { useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import {
  CANON_TYPE_SIZES,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { TextButton } from '@/src/ui/controls/TextButton';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { ONGLASS } from '@/src/ui/glass/materialTokens';
import {
  AnchoredMenu,
  type AnchorRect,
} from '@/src/ui/primitives/AnchoredMenu';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';
import {
  resolveReportMenu,
  type ReportReason,
  type ReportStatus,
} from './reportTokenPresentation';
import { MODERATION_REPORT_MENU_WIDTH } from './answerReportPresentation';

export const REPORT_MENU_WIDTH = MODERATION_REPORT_MENU_WIDTH;
const REASON_ROW_HEIGHT = 40;
/** The lead group scrolls past this share of the window (an open list editor). */
const LEAD_MAX_WINDOW_SHARE = 0.45;

export type ReportTokenMenuProps = {
  visible: boolean;
  /** The row's or the `⋯` button's window rect; `null` until measured. */
  anchor: AnchorRect | null;
  status: ReportStatus;
  onSelectReason: (reason: ReportReason) => void;
  onRetry: () => void;
  onRequestClose: () => void;
  lead?: ReactNode;
};

export function ReportTokenMenu({
  visible,
  anchor,
  status,
  onSelectReason,
  onRetry,
  onRequestClose,
  lead,
}: ReportTokenMenuProps) {
  const menu = resolveReportMenu(status);
  const { height } = useWindowDimensions();
  const leadMax = height * LEAD_MAX_WINDOW_SHARE;
  /** The fade marks clipped content only; a lead that fits draws none. */
  const [leadContent, setLeadContent] = useState(0);

  return (
    <AnchoredMenu
      visible={visible}
      anchor={anchor}
      width={REPORT_MENU_WIDTH}
      estimatedHeight={menu.reasons.length * REASON_ROW_HEIGHT + 96}
      align="end"
      radius={radii.pane}
      onRequestClose={onRequestClose}
      dismissLabel={menu.dismissLabel}
      contentStyle={styles.content}
      testID="report-token-menu"
    >
      {lead ? (
        <View style={[styles.lead, { maxHeight: leadMax }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={(_, contentHeight) =>
              setLeadContent(contentHeight)
            }
          >
            {lead}
          </ScrollView>
          {leadContent > leadMax ? (
            <ScrollEdgeFade top={spacing.sm} bottom={spacing.sm} />
          ) : null}
        </View>
      ) : null}
      <CorsoText style={styles.title} accessibilityRole="header">
        {menu.title}
      </CorsoText>

      {menu.reasons.map((row, index) => (
        <Pressable
          key={row.key}
          onPress={() => onSelectReason(row.key)}
          accessibilityRole="menuitem"
          accessibilityLabel={row.accessibilityLabel}
          style={({ pressed }) => [
            styles.row,
            index === menu.reasons.length - 1 ? null : styles.hairline,
            pressed ? styles.rowPressed : null,
          ]}
          testID={`report-reason-${row.key}`}
        >
          <CorsoText style={styles.rowLabel} numberOfLines={2}>
            {row.label}
          </CorsoText>
        </Pressable>
      ))}

      {/*
        One line, four states. `accessibilityLiveRegion` so a screen reader is
        told the outcome without the person having to go hunting for it — the
        rows they were reading have just been replaced by this.
      */}
      <CorsoText
        style={styles.note}
        accessibilityLiveRegion={status === 'idle' ? 'none' : 'polite'}
        accessibilityRole={status === 'idle' ? 'text' : 'summary'}
        testID={`report-status-${status}`}
      >
        {menu.note}
      </CorsoText>

      {menu.retryLabel ? (
        <View style={styles.actions}>
          <TextButton
            label={menu.retryLabel}
            onPress={onRetry}
            testID="report-retry"
          />
        </View>
      ) : null}
    </AnchoredMenu>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.smd,
    paddingBottom: spacing.md,
  },
  /** The filter menu's group label, verbatim: one heading treatment per app. */
  title: {
    color: colors.inkTertiary,
    fontSize: 15,
    fontFamily: typography.face('500'),
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  row: {
    justifyContent: 'center',
    minHeight: REASON_ROW_HEIGHT,
    paddingVertical: spacing.sm,
    borderRadius: radii.menuRow,
  },
  hairline: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowPressed: { backgroundColor: ONGLASS },
  rowLabel: {
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.rowLabel,
    lineHeight: 18,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
    letterSpacing: canonTracking(CANON_TYPE_SIZES.rowLabel, -0.01),
  },
  note: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.footnote,
    lineHeight: 14,
    fontFamily: typography.face('400'),
    fontWeight: canonWeight('400'),
    marginTop: spacing.sm,
  },
  actions: { marginTop: spacing.xs, gap: spacing.xs },
  lead: { flexGrow: 0, marginBottom: spacing.smd },
});

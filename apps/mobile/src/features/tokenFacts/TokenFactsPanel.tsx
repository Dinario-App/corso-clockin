import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { copy } from '@/constants/copy';
import { colors, spacing, typography } from '@/constants/theme';
import type {
  TokenFactsDisplayRow,
  TokenFactsPanelModel,
} from '@/src/features/tokenFacts/formatTokenFactsDisplay';

export function TokenFactsRow({
  label,
  value,
  valueTone,
  layout = 'inline',
}: TokenFactsDisplayRow & { layout?: 'inline' | 'stacked' }) {
  const stacked = layout === 'stacked';
  return (
    <View style={stacked ? styles.stackedRow : styles.row}>
      <Text style={stacked ? styles.stackedLabel : styles.rowLabel}>
        {label}
      </Text>
      <Text
        style={[
          stacked ? styles.stackedValue : styles.rowValue,
          valueTone === 'riskDanger' && styles.riskDangerRowValue,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function TokenFactsPanel({
  model,
  title,
}: {
  model: TokenFactsPanelModel;
  title?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsedRows = model.collapsedRows ?? [];
  const detailsLabel = `${title ?? copy.tokenFacts.panelTitle} · ${collapsedRows.length}`;
  const hasContent =
    collapsedRows.length > 0 ||
    model.banner != null ||
    model.rows.length > 0 ||
    (model.notes?.length ?? 0) > 0 ||
    model.footnote != null;

  if (!hasContent) return null;

  return (
    <View style={styles.block} accessibilityRole="summary">
      <Text style={styles.title}>{title ?? copy.tokenFacts.panelTitle}</Text>
      {model.banner ? <Text style={styles.banner}>{model.banner}</Text> : null}
      {model.rows.map((row) => (
        <TokenFactsRow key={row.label} {...row} />
      ))}
      {collapsedRows.length > 0 ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={detailsLabel}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(value => !value)}
            style={styles.detailsDoor}
          >
            <Text style={styles.rowValue}>{detailsLabel}</Text>
          </Pressable>
          {expanded ? collapsedRows.map(row => <TokenFactsRow key={row.label} {...row} />) : null}
        </>
      ) : null}
      {model.notes?.map((line) => (
        <Text key={line} style={styles.note}>
          {line}
        </Text>
      ))}
      {model.footnote ? (
        <Text style={styles.footnote}>{model.footnote}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  detailsDoor: {
    minHeight: 44,
    justifyContent: 'center',
  },
  block: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '600',
  },
  banner: {
    color: colors.muted,
    fontSize: typography.caption,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowLabel: {
    color: colors.muted,
    fontSize: typography.caption,
    flexShrink: 0,
  },
  rowValue: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  /**
   * The sentence variant: a column, so the reason text is laid out against the
   * full pane width and wraps instead of being clipped by a row that refuses
   * to shrink it. No `numberOfLines`, no ellipsis — the whole sentence reads.
   */
  stackedRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
  },
  stackedLabel: {
    color: colors.ink,
    fontSize: typography.caption,
    lineHeight: 18,
    flexShrink: 1,
    width: '100%',
  },
  stackedValue: {
    color: colors.muted,
    fontSize: typography.micro,
    flexShrink: 1,
    width: '100%',
  },
  riskDangerRowValue: {
    color: colors.riskDanger,
  },
  note: {
    color: colors.muted,
    fontSize: typography.caption,
  },
  footnote: {
    color: colors.muted,
    fontSize: typography.micro,
  },
});

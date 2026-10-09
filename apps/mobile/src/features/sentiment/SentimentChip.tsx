import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  colors,
  kitType,
  kitWeight,
  radii,
  typography,
} from '@/constants/theme';
import { loadSentimentChip } from '@/src/features/sentiment/loadSentimentChip';
import type { SentimentChipModel } from '@/src/features/sentiment/sentimentChipModel';
import { CorsoText } from '@/src/theme/CorsoText';

/**
 * Review/Ask sentiment. The visible attribution is the micro LunarCrush
 * label. Review keeps its shared floor footer; this chip adds no paragraph.
 * Hidden while loading, when the flag is off, and when LunarCrush has
 * nothing that identifies this mint. It has no Sign callback.
 */
export function SentimentChip({
  mint,
  symbol,
}: {
  mint: string;
  symbol: string;
}) {
  const [model, setModel] = useState<SentimentChipModel>({ kind: 'hidden' });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setModel({ kind: 'hidden' });
    void loadSentimentChip({
      mint,
      symbol,
      signal: controller.signal,
    }).then((next) => {
      if (!cancelled) setModel(next);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mint, symbol]);

  if (model.kind !== 'chip') return null;

  return (
    <View
      testID="sentiment-chip"
      accessibilityRole="text"
      accessibilityLabel={model.accessibilityLabel}
      style={styles.pill}
    >
      <CorsoText accessible={false} style={styles.label}>
        {model.label}
      </CorsoText>
      {model.lines.map((line) => (
        <CorsoText key={line} accessible={false} style={styles.metric}>
          {line}
        </CorsoText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceChip,
    borderColor: colors.surfaceStroke,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
    marginTop: 12,
  },
  label: {
    color: colors.inkSecondary,
    fontSize: typography.micro,
    fontWeight: kitWeight.regular,
  },
  metric: {
    color: colors.ink,
    fontSize: kitType.caption,
    fontWeight: kitWeight.medium,
  },
});

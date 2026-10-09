import { Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { presentReviewHeadlines } from './presentReviewHeadlines';
import { useReviewHeadlines } from './useReviewHeadlines';

/**
 * Review headline rows. Renders nothing when both lanes are empty.
 * Opens the publisher link. Not a Sign input.
 */
export function ReviewHeadlinesSlot() {
  const body = useReviewHeadlines();
  const rows = presentReviewHeadlines({
    body,
    nowMs: Date.now(),
  });
  if (!rows) return null;
  return (
    <View
      testID="review-headlines"
      style={{
        marginHorizontal: ethenaGeometry.gutter,
        marginTop: ethenaGeometry.gap,
        gap: 12,
      }}
    >
      {rows.map((row) => (
        <Pressable
          key={`${row.lane}:${row.link}`}
          testID="review-headline-row"
          accessibilityRole="link"
          accessibilityLabel={row.title}
          onPress={() => {
            if (!row.link.startsWith('https://')) return;
            void WebBrowser.openBrowserAsync(row.link);
          }}
        >
          <CorsoText style={{ ...ETHENA_TYPE.body, color: ethena.ink.primary }}>
            {row.title}
          </CorsoText>
          <CorsoText
            style={{ ...ETHENA_TYPE.body, color: ethena.ink.secondary }}
          >
            {row.publisher} · {row.when}
          </CorsoText>
        </Pressable>
      ))}
    </View>
  );
}

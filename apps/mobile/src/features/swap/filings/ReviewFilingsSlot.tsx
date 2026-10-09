import { Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { presentFilingsChip } from './presentFilingsChip';
import { useFilings } from './useFilings';

export function ReviewFilingsSlot({ mint }: { mint: string | null }) {
  const chip = presentFilingsChip(useFilings(mint));
  if (!chip) return null;
  return (
    <View
      testID="ethena-review-filings"
      style={{
        marginHorizontal: ethenaGeometry.gutter,
        marginTop: ethenaGeometry.gap,
        gap: 8,
      }}
    >
      {chip.lines.map((line, index) => (
        <Pressable
          key={line.href}
          testID={`ethena-review-filing-${index}`}
          onPress={() => {
            void WebBrowser.openBrowserAsync(line.href);
          }}
          accessibilityRole="link"
          accessibilityLabel={`${line.label}, ${line.freshness}`}
        >
          <CorsoText
            style={{ ...ETHENA_TYPE.body, color: ethena.ink.secondary }}
          >
            {line.label}
          </CorsoText>
          <CorsoText
            style={{ ...ETHENA_TYPE.body, color: ethena.ink.secondary }}
          >
            {line.freshness}
          </CorsoText>
        </Pressable>
      ))}
    </View>
  );
}

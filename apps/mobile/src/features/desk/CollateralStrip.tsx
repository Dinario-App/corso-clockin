import { View } from 'react-native';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { deskBrokerPreviewNode } from '@/src/features/desk/deskBrokerPreview';
import { mountedCollateralStrip } from '@/src/features/desk/presentCollateralStrip';
import { CorsoText } from '@/src/theme/CorsoText';
import { TokenIconView } from '@/src/ui/primitives/TokenIconView';

export function CollateralStrip() {
  const mounted = mountedCollateralStrip();
  if (mounted == null) return null;
  return (
    <View
      testID="desk-collateral-strip"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: ethenaGeometry.gutter,
        paddingTop: ethenaGeometry.gap,
        paddingBottom: ethenaGeometry.gap,
        gap: ethenaGeometry.gap,
      }}
    >
      {mounted.rows.map((row) => (
        <View key={row.symbol} testID="desk-collateral-row">
          <TokenIconView
            symbol={row.symbol}
            size={36}
            accessibilityLabel={row.label}
            accessible={false}
          />
          <CorsoText
            style={{ ...ETHENA_TYPE.rowName, color: ethena.ink.primary }}
          >
            {row.label}
          </CorsoText>
          <CorsoText
            style={{ ...ETHENA_TYPE.eyebrow, color: ethena.ink.secondary }}
          >
            {row.badge}
          </CorsoText>
        </View>
      ))}
      {deskBrokerPreviewNode()}
    </View>
  );
}

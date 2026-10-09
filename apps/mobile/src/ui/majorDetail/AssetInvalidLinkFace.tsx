import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { CorsoText } from '@/src/theme/CorsoText';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { MajorDetailCircle } from './MajorDetailCircle';

export function AssetInvalidLinkFace({ onBack }: { onBack: () => void }) {
  return (
    <EthenaGround>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: ethenaGeometry.gutter,
            paddingBottom: 8,
          }}
        >
          <MajorDetailCircle
            glyph="chevron-left"
            onPress={onBack}
            accessibilityLabel={copy.v1.back}
            testID="token-detail-back"
          />
        </View>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: ethenaGeometry.gutter,
          }}
        >
          <View
            testID="asset-invalid-link"
            accessibilityRole="alert"
            accessibilityLabel={`${copy.assetDetail.invalidTitle}. ${copy.assetDetail.invalidBody}`}
            style={{ alignItems: 'center', gap: 6 }}
          >
            <CorsoText
              style={{
                ...ETHENA_TYPE.navMid,
                color: ethena.ink.primary,
                textAlign: 'center',
              }}
            >
              {copy.assetDetail.invalidTitle}
            </CorsoText>
            <CorsoText
              style={{
                ...ETHENA_TYPE.sub,
                color: ethena.ink.secondary,
                textAlign: 'center',
              }}
            >
              {copy.assetDetail.invalidBody}
            </CorsoText>
          </View>
        </View>
      </SafeAreaView>
    </EthenaGround>
  );
}

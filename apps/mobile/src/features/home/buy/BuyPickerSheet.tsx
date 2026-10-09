import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { EthenaDirection, EthenaTray } from '@/src/ui/ethena/EthenaPrimitives';
import { resolveDeltaInk } from '@/src/ui/ethena/deltaInk';
import { EthenaSectionHead } from '@/src/ui/ethena/EthenaChrome';
import { resolveEthenaMaterial } from '@/src/ui/ethena/materialLaw';
import { CorsoGlass } from '@/src/ui/glass/CorsoGlass';
import { resolveFloatGlassSurface } from '@/src/ui/glass/corsoGlassRecipe';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { TokenIconView } from '@/src/ui/primitives/TokenIconView';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import type { BuyPickerModel, BuyPickerRow } from './buyPickerPresentation';

export function BuyPickerSheet({
  visible,
  model,
  onSelectMajor,
  onFindToken,
  onClose,
}: {
  visible: boolean;
  model: BuyPickerModel;
  onSelectMajor: (mint: string) => void;
  onFindToken: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const sheet = resolveEthenaMaterial('float');
  const scrollFade = useScrollLinkedFadeTop();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View
        testID="home-buy-picker"
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable
          testID="home-buy-picker-scrim"
          accessibilityRole="button"
          accessibilityLabel={model.title}
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: ethena.void,
            opacity: 0.6,
          }}
        />
        <CorsoGlass
          testID="home-buy-picker-sheet"
          material={sheet.material}
          tint={sheet.tint ?? undefined}
          radius={ethenaGeometry.radiusSheet}
          style={{
            marginHorizontal: 8,
            marginBottom: insets.bottom > 0 ? insets.bottom : 8,
            overflow: 'hidden',
            maxHeight: '85%',
          }}
        >
          <View
            style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 8 }}
          >
            <View
              style={{
                width: 36,
                height: 5,
                borderRadius: 3,
                backgroundColor: ethena.ink.tertiary,
              }}
            />
          </View>
          <CorsoText
            accessibilityRole="header"
            style={{
              ...ETHENA_TYPE.navMid,
              color: ethena.ink.primary,
              textAlign: 'center',
              paddingBottom: 8,
            }}
          >
            {model.title}
          </CorsoText>
          {/* The box the fade pins to. `flexShrink`, never `flex: 1`: the sheet
              hugs its rows up to its maxHeight. */}
          <View style={{ flexShrink: 1 }}>
            <ScrollView
              {...scrollFade.scroller}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <EthenaSectionHead label={model.majorsHeader} separates />
              <View
                style={{ gap: 10, paddingHorizontal: ethenaGeometry.gutter }}
              >
                {model.rows.map((row) => (
                  <BuyPickerRowView
                    key={row.key}
                    row={row}
                    onPress={() => onSelectMajor(row.mint)}
                  />
                ))}
              </View>
              <View style={{ height: 8 }} />
              <EthenaSectionHead label={model.everythingElseHeader} separates />
              <Pressable
                testID="home-buy-picker-find-token"
                accessibilityRole="button"
                accessibilityLabel={model.findToken}
                onPress={onFindToken}
                style={{ paddingHorizontal: ethenaGeometry.gutter }}
              >
                <EthenaTray
                  testID="home-buy-picker-find-token-tray"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 14,
                  }}
                >
                  <CorsoText
                    style={{
                      ...ETHENA_TYPE.rowName,
                      color: ethena.ink.primary,
                    }}
                  >
                    {model.findToken}
                  </CorsoText>
                  <CorsoText
                    style={{
                      ...ETHENA_TYPE.rowName,
                      color: ethena.ink.tertiary,
                    }}
                  >
                    ›
                  </CorsoText>
                </EthenaTray>
              </Pressable>
            </ScrollView>
            <ScrollEdgeFade
              top={scrollFade.top}
              color={resolveFloatGlassSurface(sheet.tint ?? undefined)}
            />
          </View>
        </CorsoGlass>
      </View>
    </Modal>
  );
}

function BuyPickerRowView({
  row,
  onPress,
}: {
  row: BuyPickerRow;
  onPress: () => void;
}) {
  const testID = `home-buy-picker-row-${row.key}`;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={row.price ? `${row.name}, ${row.price}` : row.name}
      onPress={onPress}
    >
      <EthenaTray
        testID={`${testID}-tray`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 14,
        }}
      >
        <TokenIconView
          symbol={row.symbol}
          mint={row.mint}
          size={36}
          accessibilityLabel={row.name}
          accessible={false}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <CorsoText
            numberOfLines={2}
            style={{ ...ETHENA_TYPE.rowName, color: ethena.ink.primary }}
          >
            {row.name}
          </CorsoText>
          <CorsoText
            style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.tertiary }}
          >
            {row.symbol}
          </CorsoText>
        </View>
        {row.price ? (
          <View style={{ alignItems: 'flex-end' }}>
            <CorsoText
              style={{ ...ETHENA_TYPE.rowValue, color: ethena.ink.primary }}
            >
              {row.price}
            </CorsoText>
            {row.change ? (
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                {row.change.direction ? (
                  <EthenaDirection
                    testID={`${testID}-direction`}
                    direction={row.change.direction}
                    ink="secondary"
                  />
                ) : null}
                <CorsoText
                  style={{
                    ...ETHENA_TYPE.rowDelta,
                    color: resolveDeltaInk(row.change.direction),
                  }}
                >
                  {row.change.text}
                </CorsoText>
              </View>
            ) : null}
          </View>
        ) : null}
      </EthenaTray>
    </Pressable>
  );
}

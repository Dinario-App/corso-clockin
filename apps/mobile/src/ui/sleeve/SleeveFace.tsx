import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { ethena, ethenaCaution } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import {
  sleeveHeroFontSize,
  type SleeveModel,
} from '@/src/features/sleeve/sleevePresentation';
import type {
  SleeveCapStep,
  SleeveCapView,
} from '@/src/features/sleeve/sleeveCap';
import { CorsoText } from '@/src/theme/CorsoText';
import { maskedFigureLabel, spokenFigure } from '@/src/ui/format/balanceMask';
import { EthenaSectionHead } from '@/src/ui/ethena/EthenaChrome';
import {
  EthenaGround,
  EthenaPill,
  EthenaTray,
} from '@/src/ui/ethena/EthenaPrimitives';
import { useEthenaMaterial } from '@/src/ui/ethena/useEthenaMaterial';
import { SleeveDisc } from '@/src/ui/sleeve/SleeveDisc';
import { sleeveEditCapLabel } from '@/src/ui/sleeve/sleeveEditCap';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { SCROLL_FADE_TOP } from '@/src/ui/primitives/scrollEdgeFadePresentation';

/**
 * Spine B 06, first ship. The route supplies the model and the doors.
 * Sell opens the existing held-sell door. This view does not size a trade.
 */
export function SleeveFace({
  model,
  cap = null,
  sheetOpen = false,
  onBack,
  onOpenHolding,
  onFindToken,
  onSell,
  onOpenCapSheet,
  onCloseCapSheet,
  onSelectCapStep,
  onConfirmCapStep,
  sellMessage,
}: {
  model: SleeveModel;
  cap?: SleeveCapView | null;
  sheetOpen?: boolean;
  onBack: () => void;
  onOpenHolding: (mint: string) => void;
  onFindToken: () => void;
  onSell: (mint: string) => void;
  onOpenCapSheet?: () => void;
  onCloseCapSheet?: () => void;
  onSelectCapStep?: (step: SleeveCapStep) => void;
  onConfirmCapStep?: (step: SleeveCapStep) => void;
  sellMessage?: string | null;
}) {
  const { width, fontScale } = useWindowDimensions();
  // The cap steps' control shape: a ground tray, read at render.
  const stepMaterial = useEthenaMaterial('ground');
  // Hidden until the book is priced (sleeveEditCap.ts). The notice stays.
  const editCap = sleeveEditCapLabel(cap);
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const heroText = model.hero ?? model.refusedMessage ?? '';
  const heroSize = sleeveHeroFontSize({
    text: heroText,
    fontScale: scale,
    screenWidth: width,
  });
  const heroLineHeight =
    (heroSize * ETHENA_TYPE.amount.lineHeight) / ETHENA_TYPE.amount.fontSize;
  const chipMin = Math.max(
    44,
    Math.ceil(24 + ETHENA_TYPE.pill.fontSize * scale * 1.35),
  );

  return (
    <EthenaGround>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: ethenaGeometry.gutter,
            paddingBottom: 8,
          }}
        >
          <SleeveDisc
            glyph="chevron-left"
            onPress={onBack}
            accessibilityLabel={copy.v1.back}
            testID="sleeve-back"
          />
          <CorsoText
            testID="sleeve-title"
            style={{
              ...ETHENA_TYPE.navMid,
              flex: 1,
              color: ethena.ink.primary,
            }}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {model.title}
          </CorsoText>
          {editCap ? (
            <SleeveDisc
              glyph="settings"
              onPress={onOpenCapSheet ?? (() => {})}
              accessibilityLabel={editCap}
              testID="sleeve-cap-gear"
            />
          ) : null}
        </View>
        <View style={{ flex: 1, position: 'relative' }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: ethenaGeometry.gutter,
              paddingTop: SCROLL_FADE_TOP,
              paddingBottom: 24,
              gap: 12,
            }}
            showsVerticalScrollIndicator={false}
          >
            <EthenaTray testID="sleeve-value" style={{ paddingVertical: 16 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {model.eyebrow ? (
                  <CorsoText
                    testID="sleeve-eyebrow"
                    style={{
                      ...ETHENA_TYPE.eyebrow,
                      color: ethena.ink.tertiary,
                      flexShrink: 1,
                    }}
                  >
                    {model.eyebrow}
                  </CorsoText>
                ) : (
                  <View />
                )}
                {editCap ? (
                  <Pressable
                    testID="sleeve-edit-cap"
                    accessibilityRole="button"
                    accessibilityLabel={editCap}
                    onPress={onOpenCapSheet}
                  >
                    <CorsoText
                      style={{ ...ETHENA_TYPE.sub, color: ethena.ink.primary }}
                    >
                      {editCap}
                    </CorsoText>
                  </Pressable>
                ) : null}
              </View>
              {model.refusedMessage ? (
                <CorsoText
                  testID="sleeve-refused"
                  style={{
                    ...ETHENA_TYPE.sub,
                    color: ethena.ink.primary,
                    marginTop: 8,
                  }}
                >
                  {model.refusedMessage}
                </CorsoText>
              ) : (
                <CorsoText
                  testID="sleeve-hero"
                  accessibilityLabel={maskedFigureLabel(model.hero)}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.4}
                  allowFontScaling={false}
                  style={{
                    ...ETHENA_TYPE.amount,
                    marginTop: 4,
                    fontSize: heroSize,
                    lineHeight: heroLineHeight,
                    color: ethena.ink.primary,
                  }}
                >
                  {model.hero}
                </CorsoText>
              )}
              {cap?.showCapUi && model.state === 'empty' && cap.emptyLine ? (
                <CorsoText
                  testID="sleeve-cap-empty"
                  style={{
                    ...ETHENA_TYPE.sub,
                    color: ethena.ink.secondary,
                    marginTop: 8,
                  }}
                >
                  {cap.emptyLine}
                </CorsoText>
              ) : model.keepSmall && !cap?.showCapUi ? (
                <CorsoText
                  testID="sleeve-keep-small"
                  style={{
                    ...ETHENA_TYPE.sub,
                    color: ethena.ink.secondary,
                    marginTop: 8,
                  }}
                >
                  {model.keepSmall}
                </CorsoText>
              ) : null}
              {cap?.bar ? (
                <View
                  testID="sleeve-cap-bar"
                  style={{
                    marginTop: 12,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: ethena.ink.tertiary,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(cap.bar.fill * 100)}%`,
                      height: 4,
                      backgroundColor: ethena.ink.primary,
                    }}
                  />
                </View>
              ) : null}
              {cap?.status || cap?.ofTotal ? (
                <View
                  style={{
                    marginTop: 8,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  {cap.status ? (
                    <CorsoText
                      testID="sleeve-cap-status"
                      style={{ ...ETHENA_TYPE.sub, color: ethena.ink.secondary }}
                      accessibilityLabel={maskedFigureLabel(cap.status)}
                    >
                      <CorsoText style={{ color: ethenaCaution }}>● </CorsoText>
                      {cap.status}
                    </CorsoText>
                  ) : null}
                  {cap.ofTotal ? (
                    <CorsoText
                      testID="sleeve-cap-share"
                      style={{ ...ETHENA_TYPE.sub, color: ethena.ink.tertiary }}
                      accessibilityLabel={maskedFigureLabel(cap.ofTotal)}
                    >
                      {cap.ofTotal}
                    </CorsoText>
                  ) : null}
                </View>
              ) : null}
              {cap?.notice ? (
                <View testID="sleeve-cap-notice" style={{ marginTop: 12 }}>
                  <CorsoText
                    style={{ ...ETHENA_TYPE.sub, color: ethena.ink.primary }}
                  >
                    <CorsoText style={{ color: ethenaCaution }}>⚠ </CorsoText>
                    {cap.notice.title}
                  </CorsoText>
                  <CorsoText
                    style={{
                      ...ETHENA_TYPE.sub,
                      color: ethena.ink.secondary,
                      marginTop: 4,
                    }}
                    accessibilityLabel={maskedFigureLabel(cap.notice.body)}
                  >
                    {cap.notice.body}
                  </CorsoText>
                </View>
              ) : null}
            </EthenaTray>
            {sellMessage ? (
              <CorsoText
                testID="sleeve-sell-message"
                style={{ ...ETHENA_TYPE.sub, color: ethena.ink.secondary }}
              >
                {sellMessage}
              </CorsoText>
            ) : null}
            <EthenaSectionHead
              testID="sleeve-holdings"
              label={model.holdingsLabel}
              right={model.countLabel ?? undefined}
            />
            {model.state === 'empty' && model.rows.length === 0 ? (
              <CorsoText
                testID="sleeve-holdings-empty"
                style={{
                  ...ETHENA_TYPE.sub,
                  color: ethena.ink.tertiary,
                  // In line with the section head's label above it.
                  paddingHorizontal: ethenaGeometry.gutter,
                }}
              >
                {copy.homeBook.emptySleeve}
              </CorsoText>
            ) : null}
            {model.rows.map((row) => {
              return (
                <View
                  key={row.mint}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    columnGap: 8,
                  }}
                >
                  <Pressable
                    testID={`sleeve-row-${row.mint}`}
                    accessibilityRole="button"
                    accessibilityLabel={
                      row.value
                        ? `${row.name}, ${spokenFigure(row.value)}`
                        : row.name
                    }
                    onPress={() => onOpenHolding(row.mint)}
                    style={{ flex: 1, minHeight: chipMin }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        columnGap: 8,
                        rowGap: 4,
                        paddingVertical: 8,
                      }}
                    >
                      <View
                        style={{ flexGrow: 1, flexShrink: 1, minWidth: 140 }}
                      >
                        <CorsoText
                          style={{
                            ...ETHENA_TYPE.rowName,
                            color: ethena.ink.primary,
                          }}
                        >
                          {row.name}
                        </CorsoText>
                        {row.quantity ? (
                          <CorsoText
                            style={{
                              ...ETHENA_TYPE.rowSub,
                              color: ethena.ink.tertiary,
                            }}
                          >
                            {row.quantity} {row.symbol}
                          </CorsoText>
                        ) : null}
                      </View>
                      {row.value ? (
                        <CorsoText
                          style={{
                            ...ETHENA_TYPE.rowValue,
                            color: ethena.ink.primary,
                          }}
                        >
                          {row.value}
                        </CorsoText>
                      ) : null}
                    </View>
                  </Pressable>
                  {model.sell.shown ? (
                    <Pressable
                      testID="sleeve-sell"
                      accessibilityRole="button"
                      accessibilityLabel={`${model.sell.label} ${row.symbol}`}
                      accessibilityState={{ disabled: model.sell.disabled }}
                      disabled={model.sell.disabled}
                      onPress={
                        model.sell.disabled ? undefined : () => onSell(row.mint)
                      }
                      style={{
                        minHeight: chipMin,
                        justifyContent: 'center',
                        paddingHorizontal: 8,
                      }}
                    >
                      <CorsoText
                        style={{
                          ...ETHENA_TYPE.pill,
                          color: ethena.ink.primary,
                        }}
                      >
                        {model.sell.label}
                      </CorsoText>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            {model.sell.shown ? (
              <Pressable
                testID="sleeve-find"
                accessibilityRole="button"
                accessibilityLabel={model.findToken.label}
                accessibilityState={{ disabled: model.findToken.disabled }}
                disabled={model.findToken.disabled}
                onPress={model.findToken.disabled ? undefined : onFindToken}
                style={{ minHeight: chipMin, justifyContent: 'center' }}
              >
                <CorsoText
                  style={{ ...ETHENA_TYPE.sub, color: ethena.ink.primary }}
                >
                  {model.findToken.label}
                </CorsoText>
              </Pressable>
            ) : null}
          </ScrollView>
          <ScrollEdgeFade
            testID="sleeve-scroll-fade"
            color={ethena.groundStops[0][1]}
          />
        </View>
        {model.note ? (
          <CorsoText
            testID="sleeve-note"
            style={{
              ...ETHENA_TYPE.sub,
              color: ethena.ink.secondary,
              paddingHorizontal: ethenaGeometry.gutter,
              paddingBottom: 8,
            }}
          >
            {model.note}
          </CorsoText>
        ) : null}
        {cap?.showCapUi && cap.raiseCap && model.sell.shown && model.rows.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              paddingHorizontal: ethenaGeometry.gutter,
              paddingBottom: 8,
            }}
          >
            <View style={{ flex: 1 }}>
              <EthenaPill
                testID="sleeve-raise-cap"
                label={cap.raiseCap}
                plane="floatAction"
                onPress={onOpenCapSheet}
              />
            </View>
            <View style={{ flex: 1 }}>
              <EthenaPill
                testID="sleeve-floor-sell"
                label={model.sell.label}
                plane="cta"
                disabled={model.sell.disabled}
                onPress={
                  model.sell.disabled || !model.rows[0]
                    ? undefined
                    : () => onSell(model.rows[0].mint)
                }
              />
            </View>
          </View>
        ) : null}
        {!model.sell.shown || model.rows.length === 0 ? (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              paddingHorizontal: ethenaGeometry.gutter,
              paddingBottom: 8,
            }}
          >
            {!model.sell.shown ? (
              <View style={{ flex: 1 }}>
                <EthenaPill
                  testID="sleeve-find"
                  label={model.findToken.label}
                  plane="ground"
                  disabled={model.findToken.disabled}
                  onPress={model.findToken.disabled ? undefined : onFindToken}
                />
              </View>
            ) : (
              <>
                {cap?.showCapUi && cap.raiseCap ? (
                  <View style={{ flex: 1 }}>
                    <EthenaPill
                      testID="sleeve-raise-cap"
                      label={cap.raiseCap}
                      plane="floatAction"
                      onPress={onOpenCapSheet}
                    />
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <EthenaPill
                    testID="sleeve-sell"
                    label={model.sell.label}
                    plane="cta"
                    disabled
                  />
                </View>
              </>
            )}
          </View>
        ) : null}
        {sheetOpen && cap?.sheet ? (
          <View
            testID="sleeve-cap-sheet"
            style={{
              paddingHorizontal: ethenaGeometry.gutter,
              paddingBottom: 12,
              gap: 8,
            }}
          >
            <View
              accessibilityRole="radiogroup"
              accessible={false}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
            >
              {cap.sheet.steps.map((step) => {
                const chosen = step === cap.sheet?.selected;
                return (
                  <Pressable
                    key={step}
                    testID={`sleeve-cap-step-${step}`}
                    accessibilityRole="radio"
                    accessibilityLabel={`${step} percent`}
                    accessibilityState={{
                      selected: chosen,
                      checked: chosen,
                    }}
                    onPress={() => onSelectCapStep?.(step)}
                    // The Add cash amount chip: a tray at the chip height,
                    // the chosen one edged in primary ink.
                    style={{
                      minHeight: ethenaGeometry.segHeight,
                      minWidth: 64,
                      paddingHorizontal: 16,
                      borderRadius: ethenaGeometry.segHeight / 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: String(stepMaterial.fill),
                      borderWidth: chosen ? 1 : stepMaterial.borderWidth,
                      borderColor: chosen
                        ? ethena.ink.primary
                        : (stepMaterial.borderColor ?? undefined),
                    }}
                  >
                    <CorsoText
                      accessible={false}
                      style={{
                        ...ETHENA_TYPE.pill,
                        // Secondary, not tertiary: tertiary is under 4.5:1 on
                        // a tray wherever the ground is lit.
                        color: chosen
                          ? ethena.ink.primary
                          : ethena.ink.secondary,
                      }}
                    >
                      {step}%
                    </CorsoText>
                  </Pressable>
                );
              })}
            </View>
            {cap.sheet.dollars ? (
              <CorsoText
                testID="sleeve-cap-dollars"
                style={{ ...ETHENA_TYPE.sub, color: ethena.ink.primary }}
              >
                {cap.sheet.dollars}
              </CorsoText>
            ) : null}
            <CorsoText
              testID="sleeve-cap-lower"
              style={{ ...ETHENA_TYPE.sub, color: ethena.ink.secondary }}
            >
              {cap.sheet.lower}
            </CorsoText>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <EthenaPill
                  testID="sleeve-cap-confirm"
                  label={cap.sheet.confirm}
                  plane="floatAction"
                  onPress={() =>
                    cap.sheet ? onConfirmCapStep?.(cap.sheet.selected) : undefined
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <EthenaPill
                  testID="sleeve-cap-close"
                  label={copy.askSheet.close}
                  plane="ground"
                  onPress={onCloseCapSheet}
                />
              </View>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </EthenaGround>
  );
}

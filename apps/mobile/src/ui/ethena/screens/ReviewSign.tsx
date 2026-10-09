import type { ReactNode } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena, ethenaAction, ethenaCaution } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_BODY_MARGIN, ETHENA_TYPE } from '@/constants/theme.ethenaType';
import {
  EthenaGround,
  EthenaPill,
  EthenaTray,
} from '@/src/ui/ethena/EthenaPrimitives';
import {
  EthenaHomeIndicator,
  EthenaNav,
  EthenaStatusBar,
} from '@/src/ui/ethena/EthenaChrome';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import {
  SCROLL_FADE_TOP,
  SCROLL_FADE_BOTTOM,
} from '@/src/ui/primitives/scrollEdgeFadePresentation';
import type { ReviewSignModel } from '@/src/ui/ethena/reviewSignModel';

/** The screen renders a required presenter model and delegates every action.
 * Only Sign gets icy material; its callback retains the route's safety gates.
 * Wait is the glass peer of Sign on the equal-width floor.
 * The body scrolls independently of that floor. The context card holds bag,
 * an existing chart surface, empty chip slots, an optional list slot, and Explain. */
export function ReviewSign({
  model,
  onBack,
  onExplain,
  onWait,
  onSign,
  onRequote,
  onAddCash,
  onRetry,
  children,
  chartSurface,
  contextExtra,
  floorQualifier,
  chrome = 'route',
  capLinks = null,
  onSeeHoldings,
  onRaiseCap,
}: {
  model: ReviewSignModel;
  onBack?: () => void;
  onExplain?: () => void;
  onWait?: () => void;
  onSign?: () => void;
  onRequote?: () => void;
  onAddCash?: () => void;
  onRetry?: () => void;
  children?: ReactNode;
  /** Existing chart surface (PriceChart). Omitted when empty — no trench. */
  chartSurface?: ReactNode;
  /** Caller-supplied context, drawn inside the card. Omitted when empty. */
  contextExtra?: ReactNode;
  floorQualifier?: string;
  chrome?: 'route' | 'canon';
  capLinks?: { seeHoldings: string | null; raiseCap: string | null } | null;
  onSeeHoldings?: () => void;
  onRaiseCap?: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.5;
  const signing = model.state === 'signing';
  const chips = model.chips ?? [];
  const onAction =
    model.action === 'sign'
      ? onSign
      : model.action === 'requote'
        ? onRequote
        : model.action === 'addCash'
          ? onAddCash
          : model.action === 'retry'
            ? onRetry
            : undefined;
  return (
    <EthenaGround>
      {chrome === 'canon' ? <EthenaStatusBar /> : null}
      <EthenaNav
        left={
          <Pressable
            testID="ethena-back"
            onPress={signing ? undefined : onBack}
            disabled={signing}
            accessibilityRole="button"
            accessibilityLabel="Back"
            accessibilityState={{ disabled: signing }}
          >
            <CorsoText
              style={{ ...ETHENA_TYPE.back, color: ethena.ink.primary }}
            >
              ‹
            </CorsoText>
          </Pressable>
        }
      />
      <View style={{ flex: 1 }}>
        <ScrollView
          testID="ethena-review-body"
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: SCROLL_FADE_TOP,
            paddingBottom: SCROLL_FADE_BOTTOM + ethenaGeometry.gap,
          }}
        >
          <View
            style={{
              paddingHorizontal: ethenaGeometry.gutter,
              paddingTop: 10,
              paddingBottom: 18,
            }}
          >
            <CorsoText
              style={{ ...ETHENA_TYPE.title, color: ethena.ink.primary }}
            >
              {model.title}
            </CorsoText>
          </View>
          {model.caution ? (
            <EthenaTray
              testID="ethena-review-caution"
              style={{
                marginHorizontal: ethenaGeometry.gutter,
                paddingVertical: 16,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <CorsoText
                  testID="ethena-review-caution-glyph"
                  style={{ ...ETHENA_TYPE.cardCaution, color: ethenaCaution }}
                >
                  ⚠
                </CorsoText>
                <CorsoText
                  style={{
                    ...ETHENA_TYPE.cardHeading,
                    color: ethena.ink.primary,
                    flex: 1,
                  }}
                >
                  {model.caution.heading}
                </CorsoText>
              </View>
              <CorsoText
                style={{
                  ...ETHENA_TYPE.body,
                  color: ethena.ink.secondary,
                  marginTop: ETHENA_BODY_MARGIN,
                }}
              >
                {model.caution.body}
              </CorsoText>
              {capLinks?.seeHoldings || capLinks?.raiseCap ? (
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 16,
                    marginTop: ETHENA_BODY_MARGIN,
                  }}
                >
                  {capLinks.seeHoldings ? (
                    <Pressable
                      testID="cap-see-holdings"
                      accessibilityRole="button"
                      onPress={onSeeHoldings}
                    >
                      <CorsoText
                        style={{
                          ...ETHENA_TYPE.body,
                          color: ethena.ink.primary,
                        }}
                      >
                        {capLinks.seeHoldings}
                      </CorsoText>
                    </Pressable>
                  ) : null}
                  {capLinks.raiseCap ? (
                    <Pressable
                      testID="cap-raise"
                      accessibilityRole="button"
                      onPress={onRaiseCap}
                    >
                      <CorsoText
                        style={{
                          ...ETHENA_TYPE.body,
                          color: ethena.ink.primary,
                        }}
                      >
                        {capLinks.raiseCap}
                      </CorsoText>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </EthenaTray>
          ) : null}
          {model.costs.length > 0 || model.total ? (
            <EthenaTray
              testID="ethena-review-costs"
              style={{
                marginHorizontal: ethenaGeometry.gutter,
                marginTop: ethenaGeometry.gap,
                paddingVertical: 4,
              }}
            >
              {model.costs.map((line) => (
                <ReviewRow key={line.label} {...line} stacked={stacked} />
              ))}
              {model.total ? (
                <ReviewRow {...model.total} total stacked={stacked} />
              ) : null}
              {(model.trailingCosts ?? []).map((line) => (
                <ReviewRow key={line.label} {...line} stacked={stacked} />
              ))}
            </EthenaTray>
          ) : null}
          {model.bag ||
          model.afterSale ||
          (model.chart && chartSurface) ||
          chips.length > 0 ||
          contextExtra ||
          model.explain ? (
            <EthenaTray
              testID="ethena-review-context"
              style={{
                marginHorizontal: ethenaGeometry.gutter,
                marginTop: ethenaGeometry.gap,
                paddingVertical: 16,
              }}
            >
              {model.bag ? (
                <CorsoText
                  testID="ethena-review-bag"
                  style={{
                    ...ETHENA_TYPE.body,
                    color: ethena.ink.secondary,
                  }}
                >
                  {model.bag}
                </CorsoText>
              ) : null}
              {model.afterSale ? (
                <CorsoText
                  testID="ethena-review-after"
                  style={{
                    ...ETHENA_TYPE.body,
                    color: ethena.ink.secondary,
                    marginTop: model.bag ? ETHENA_BODY_MARGIN : 0,
                  }}
                >
                  {model.afterSale}
                </CorsoText>
              ) : null}
              {model.chart && chartSurface ? (
                <View
                  testID="ethena-review-chart"
                  style={{
                    marginTop:
                      model.bag || model.afterSale ? ETHENA_BODY_MARGIN : 0,
                  }}
                >
                  {chartSurface}
                </View>
              ) : null}
              {chips.length > 0 ? (
                <View
                  testID="ethena-review-chips"
                  style={{
                    flexDirection: stacked ? 'column' : 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop:
                      model.bag ||
                      model.afterSale ||
                      (model.chart && chartSurface)
                        ? ETHENA_BODY_MARGIN
                        : 0,
                  }}
                >
                  {chips.map((chip) => (
                    <CorsoText
                      key={chip.key}
                      testID={`ethena-review-chip-${chip.key}`}
                      style={{
                        ...ETHENA_TYPE.body,
                        color: ethena.ink.secondary,
                      }}
                    >
                      {chip.label}
                    </CorsoText>
                  ))}
                </View>
              ) : null}
              {contextExtra ? (
                <View testID="ethena-review-watchlist">{contextExtra}</View>
              ) : null}
              {model.explain ? (
                <View
                  testID="ethena-review-explain"
                  style={{
                    marginTop:
                      model.bag ||
                      model.afterSale ||
                      (model.chart && chartSurface) ||
                      chips.length > 0 ||
                      contextExtra
                        ? ETHENA_BODY_MARGIN
                        : 0,
                  }}
                >
                  <View
                    style={{
                      flexDirection: stacked ? 'column' : 'row',
                      gap: 8,
                      justifyContent: 'space-between',
                      alignItems: stacked ? 'flex-start' : 'center',
                    }}
                  >
                    <CorsoText
                      style={{
                        ...ETHENA_TYPE.cardHeading,
                        color: ethena.ink.primary,
                        flexShrink: 1,
                      }}
                    >
                      {model.explain.heading}
                    </CorsoText>
                    <Pressable
                      testID="ethena-review-explain-action"
                      onPress={onExplain}
                      accessibilityRole="button"
                    >
                      <CorsoText
                        style={{
                          ...ETHENA_TYPE.cardAction,
                          color: ethenaAction,
                        }}
                      >
                        {model.explain.action}
                      </CorsoText>
                    </Pressable>
                  </View>
                  {model.explain.body ? (
                    <CorsoText
                      style={{
                        ...ETHENA_TYPE.body,
                        color: ethena.ink.secondary,
                        marginTop: ETHENA_BODY_MARGIN,
                      }}
                    >
                      {model.explain.body}
                    </CorsoText>
                  ) : null}
                </View>
              ) : null}
            </EthenaTray>
          ) : null}
          {children}
        </ScrollView>
        <ScrollEdgeFade
          top={SCROLL_FADE_TOP}
          bottom={0}
          color={ethena.groundStops[0][1]}
          testID="ethena-review-fade-top"
        />
        <ScrollEdgeFade
          top={0}
          bottom={SCROLL_FADE_BOTTOM}
          color={ethena.void}
          testID="ethena-review-fade-bottom"
        />
      </View>
      {floorQualifier ? (
        <CorsoText
          testID="ethena-review-floor-qualifier"
          style={{
            ...ETHENA_TYPE.body,
            color: ethena.ink.secondary,
            paddingHorizontal: ethenaGeometry.gutter,
            paddingVertical: 8,
          }}
        >
          {floorQualifier}
        </CorsoText>
      ) : null}
      {/* The commit row is a DECISION group (materialLaw.ts header): Wait and
          Buy/Sell answer one decision, so at most one of them is icy. */}
      <View
        testID="ethena-review-commit-row"
        style={{
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: ethenaGeometry.gutter,
          paddingBottom: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <EthenaPill
            style={{ flex: undefined, flexGrow: 1 }}
            testID="ethena-review-wait"
            label={model.wait}
            plane="floatAction"
            disabled={model.waitDisabled || signing}
            onPress={onWait}
          />
        </View>
        {model.action !== 'none' ? (
          <View style={{ flex: 1 }}>
            <EthenaPill
              key={model.action}
              style={{ flex: undefined, flexGrow: 1 }}
              testID="ethena-review-sign"
              label={model.sign}
              plane={model.action === 'sign' ? 'cta' : 'floatAction'}
              disabled={model.disabled}
              onPress={onAction}
            />
          </View>
        ) : null}
      </View>
      {chrome === 'canon' ? <EthenaHomeIndicator /> : null}
    </EthenaGround>
  );
}

function ReviewRow({
  label,
  value,
  total = false,
  muted = false,
  stacked,
}: {
  label: string;
  value: string;
  total?: boolean;
  muted?: boolean;
  stacked: boolean;
}) {
  const type = total ? ETHENA_TYPE.keyValueTotal : ETHENA_TYPE.keyValue;
  return (
    <View
      style={{
        flexDirection: stacked ? 'column' : 'row',
        justifyContent: 'space-between',
        gap: 8,
        paddingVertical: 12,
      }}
    >
      <CorsoText
        style={{
          ...type,
          color: total ? ethena.ink.primary : ethena.ink.secondary,
          flexShrink: 1,
        }}
      >
        {label}
      </CorsoText>
      <CorsoText
        style={{
          ...type,
          color: muted ? ethena.ink.secondary : ethena.ink.primary,
          flexShrink: 1,
          textAlign: stacked ? 'left' : 'right',
        }}
      >
        {value}
      </CorsoText>
    </View>
  );
}

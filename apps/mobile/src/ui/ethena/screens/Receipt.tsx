import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import type { ReactNode } from 'react';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena, ethenaAction } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { EthenaGround, EthenaPill, EthenaTray } from '@/src/ui/ethena/EthenaPrimitives';
import { EthenaBack, EthenaCoin, EthenaHero, EthenaHomeIndicator, EthenaNav, EthenaSectionHead, EthenaStatusBar } from '@/src/ui/ethena/EthenaChrome';
import { TokenIconView } from '@/src/ui/primitives/TokenIconView';
import { resolveEthenaMaterial } from '@/src/ui/ethena/materialLaw';
import { CorsoGlass } from '@/src/ui/glass/CorsoGlass';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { SCROLL_FADE_TOP, SCROLL_FADE_BOTTOM } from '@/src/ui/primitives/scrollEdgeFadePresentation';
import type { ReceiptModel } from '@/src/ui/ethena/receiptModel';
import { maskedFigureLabel } from '@/src/ui/format/balanceMask';

/** Snapshot props are a saved record, never a read of the current book.
 * `finalised` wears the same secondary ink as every other status.
 * Done commits nothing: zero icy objects and no share action in v1. */
function ReceiptRow({ label, value, info, total, id, large }: {
  label: string; value: string; info?: boolean; total?: boolean; id: string; large: boolean;
}) {
  return <View testID={id} style={{ paddingVertical: 12, gap: 6, flexDirection: large ? 'column' : 'row', justifyContent: 'space-between' }}>
    <CorsoText style={{ ...(total ? ETHENA_TYPE.keyValueTotal : ETHENA_TYPE.keyValue), color: ethena.ink.secondary, flexShrink: 1 }}>{label}{info ? ' ⓘ' : ''}</CorsoText>
    <CorsoText style={{ ...(total ? ETHENA_TYPE.keyValueTotal : ETHENA_TYPE.keyValue), color: ethena.ink.primary, flexShrink: 1 }} accessibilityLabel={maskedFigureLabel(value)}>{value}</CorsoText>
  </View>;
}
export function Receipt({ model, onBack, onDone, onViewOnChain, chrome = 'route', seen }: {
  model: ReceiptModel;
  seen?: ReactNode;
  onBack?: () => void;
  onDone?: () => void;
  onViewOnChain?: () => void;
  chrome?: 'canon' | 'route';
}) {
  const askDisc = resolveEthenaMaterial('summons');
  const large = useWindowDimensions().fontScale >= 1.5;
  return <EthenaGround>
    {chrome === 'canon' ? <EthenaStatusBar /> : null}
    <View testID="ethena-receipt-nav"><EthenaNav left={<EthenaBack onPress={onBack} />} /></View>
    <View style={{ flex: 1, position: 'relative' }}>
    <ScrollView testID="ethena-receipt-scroll" style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingTop: SCROLL_FADE_TOP, paddingBottom: SCROLL_FADE_BOTTOM + ethenaGeometry.gap }}>
      <View testID="ethena-receipt-summary">
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, minWidth: 0 }}><EthenaHero testID="ethena-receipt-hero" align="left" amount={model.amount} amountAccessibilityLabel={maskedFigureLabel(model.amount)} cents={model.cents} /></View>
          <View style={{ marginRight: ethenaGeometry.gutter }}>{model.coinSymbol ? <TokenIconView symbol={model.coinSymbol} mint={model.coinMint} size={48} accessibilityLabel={model.coinSymbol} /> : <EthenaCoin glyph={model.coinGlyph} mark={model.coinMark} size={48} />}</View>
        </View>
        <CorsoText testID="ethena-receipt-status" style={{ ...ETHENA_TYPE.sub, color: ethena.ink.secondary, paddingHorizontal: ethenaGeometry.gutter }} accessibilityLabel={maskedFigureLabel(model.sub)}>{model.sub}</CorsoText>
      </View>
      <EthenaTray testID="ethena-receipt-trade" style={{ marginHorizontal: ethenaGeometry.gutter, marginTop: 24, paddingVertical: 4 }}>
        {model.trade.map((line, at) => <ReceiptRow key={`${at}-${line.label}`} id={`ethena-receipt-row-${at}`} {...line} large={large} />)}
        {model.kept ? <ReceiptRow id="ethena-receipt-kept" {...model.kept} total large={large} /> : null}
      </EthenaTray>
      {model.frozen ? <View testID="ethena-receipt-frozen-block" style={{ marginTop: 16 }}>
        <EthenaSectionHead testID="ethena-receipt-frozen-head" label={model.frozen.heading} right={model.frozen.note} />
        <EthenaTray testID="ethena-receipt-frozen" style={{ marginHorizontal: ethenaGeometry.gutter, paddingVertical: 16 }}>
          <CorsoText style={{ ...ETHENA_TYPE.body, color: ethena.ink.secondary }} accessibilityLabel={maskedFigureLabel(model.frozen.body)}>{model.frozen.body}</CorsoText>
          <ReceiptRow id="ethena-receipt-quote-age" label={model.frozen.quoteLabel} value={model.frozen.quoteValue} large={large} />
        </EthenaTray>
      </View> : null}
      {seen ?? null}
      {model.chain ? <EthenaTray testID="ethena-receipt-chain" style={{ marginHorizontal: ethenaGeometry.gutter, marginTop: ethenaGeometry.gap, paddingVertical: 16 }}>
        <View style={{ flexDirection: large ? 'column' : 'row', gap: 12, justifyContent: 'space-between', alignItems: large ? 'flex-start' : 'center' }}>
          <CorsoText style={{ ...ETHENA_TYPE.cardHeading, color: ethena.ink.primary }}>{model.chain.signature}</CorsoText>
          <Pressable testID="ethena-receipt-chain-action" onPress={onViewOnChain} accessibilityRole="link"><CorsoText style={{ ...ETHENA_TYPE.cardAction, color: ethenaAction }}>{model.chain.action}</CorsoText></Pressable>
        </View>
      </EthenaTray> : null}
      <View style={{ flex: 1, minHeight: 24 }} />
      <View testID="ethena-receipt-floor" style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: ethenaGeometry.gutter, paddingBottom: 8 }}>
        <EthenaPill testID="ethena-receipt-done" label={model.done} plane="ground" onPress={onDone} />
        <CorsoGlass testID="ethena-receipt-trailing" material={askDisc.material} tint={askDisc.tint ?? undefined} radius={ethenaGeometry.pillHeight / 2} style={{ width: ethenaGeometry.pillHeight, height: ethenaGeometry.pillHeight, alignItems: 'center', justifyContent: 'center' }}>
          <CorsoText style={{ ...ETHENA_TYPE.circle, color: ethena.ink.primary }}>✦</CorsoText>
        </CorsoGlass>
      </View>
    </ScrollView>
    <ScrollEdgeFade top={SCROLL_FADE_TOP} bottom={0} color={ethena.groundStops[0][1]} testID="ethena-receipt-fade-top" />
    <ScrollEdgeFade top={0} bottom={SCROLL_FADE_BOTTOM} color={ethena.void} testID="ethena-receipt-fade-bottom" />
    </View>
    {chrome === 'canon' ? <EthenaHomeIndicator /> : null}
  </EthenaGround>;
}

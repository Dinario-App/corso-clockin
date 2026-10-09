import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { composeCorsoFeeExplain } from '@/src/features/skills/feeExplainTemplate';
import { TEMPLATE_IDS } from '@/src/features/skills/templateIds';
import type { FrozenSwapReviewIntent } from '@/src/features/swap/swapReviewIntent';
import { SOL_MINT } from '@/src/features/swap/tokens';

export type SwapFeeExplanationIntent = Pick<FrozenSwapReviewIntent,
  'instructionVersion' | 'inputMint' | 'corsoFeeBps' | 'quoteFeeBps' |
  'platformFeeBps' | 'platformFeeAmount' | 'feeMint' | 'feeDropped' | 'feeDisplayName'>;

export function SwapFeeExplanation({ intent, style, lineStyle }: {
  intent: SwapFeeExplanationIntent;
  style?: StyleProp<ViewStyle>;
  lineStyle?: StyleProp<TextStyle>;
}) {
  const lines = composeCorsoFeeExplain({
    context: 'swap_review',
    corsoFeeBps: intent.corsoFeeBps,
    quoteFeeBps: intent.quoteFeeBps,
    platformFeeBps: intent.platformFeeBps,
    platformFeeAmountAtomic: intent.platformFeeAmount,
    feeMint: intent.feeMint,
    feeDropped: intent.feeDropped,
    feeDisplayName: intent.feeDisplayName,
  });
  const solInputFee = intent.instructionVersion === 'V2' &&
    intent.inputMint === SOL_MINT && intent.platformFeeBps === 0 &&
    intent.feeMint === SOL_MINT;
  if (lines.length === 0) return null;
  return (
    <View style={style} accessibilityLiveRegion="polite">
      {lines.map((line) => (
        <CorsoText key={line.templateId} style={lineStyle}>
          {solInputFee && line.templateId === TEMPLATE_IDS.FEE_CORSO_ON_TOP
            ? copy.swap.corsoFeeSolInputExplain
            : line.text}
        </CorsoText>
      ))}
    </View>
  );
}

import { Text, View } from 'react-native';
import {
  resolveTokenIcon,
  TOKEN_ICON_IMAGE,
} from '@/src/features/tokens/tokenIconResolve';
import { TokenIconImage } from '@/src/ui/primitives/TokenIconView';
import {
  resolveTokenMarkPresentation,
  type TokenMarkSize,
  type TokenMarkTicker,
} from '@/src/ui/primitives/tokenMarkPresentation.js';

export type TokenMarkProps = {
  ticker: TokenMarkTicker;
  /** Caller-owned contextual label, e.g. "SOL token" or "Pay with USDC". */
  accessibilityLabel: string;
  /** 40pt default disc; 36pt for TokenPairMark; 48pt for promoted AssetRow. */
  size?: TokenMarkSize;
  /** Mint identity. A caller cannot pass an image URI. */
  mint?: string | null;
  testID?: string;
};

export function TokenMark({
  ticker,
  accessibilityLabel,
  size,
  mint,
  testID,
}: TokenMarkProps) {
  const presentation = resolveTokenMarkPresentation({
    ticker,
    accessibilityLabel,
    size,
  });
  const icon = resolveTokenIcon({ mint, symbol: presentation.ticker });
  const width = presentation.containerStyle.width;
  const disc =
    typeof width === 'number' ? width : presentation.containerStyle.height;

  return (
    <View
      testID={testID}
      style={presentation.containerStyle}
      accessible={presentation.accessible}
      accessibilityRole={presentation.accessibilityRole}
      accessibilityLabel={presentation.accessibilityLabel}
    >
      {icon.kind === TOKEN_ICON_IMAGE ? (
        <TokenIconImage
          uri={icon.uri}
          format={icon.format}
          label={presentation.displayLabel}
          textStyle={presentation.textStyle}
          size={typeof disc === 'number' ? disc : 0}
        />
      ) : (
        <Text importantForAccessibility="no" style={presentation.textStyle}>
          {presentation.displayLabel}
        </Text>
      )}
    </View>
  );
}

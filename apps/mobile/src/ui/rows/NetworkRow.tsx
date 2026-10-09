import { Pressable, Text, View, type PressableProps } from 'react-native';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon.js';
import { TokenMark } from '@/src/ui/primitives/TokenMark.js';
import { resolveNetworkRowPresentation } from '@/src/ui/rows/networkRowPresentation.js';

export type NetworkRowProps = {
  cluster: 'mainnet-beta' | 'devnet';
  selected?: boolean;
  onPress: NonNullable<PressableProps['onPress']>;
  accessibilityLabel?: string;
  testID?: string;
};

export function NetworkRow({
  cluster,
  selected = false,
  onPress,
  accessibilityLabel,
  testID,
}: NetworkRowProps) {
  const presentation = resolveNetworkRowPresentation({ cluster, selected });

  if (presentation === null) {
    return null;
  }

  return (
    <Pressable
      testID={testID}
      style={presentation.containerStyle}
      hitSlop={presentation.hitSlop}
      onPress={onPress}
      accessibilityRole={presentation.accessibilityRole}
      accessibilityLabel={
        accessibilityLabel ?? presentation.accessibilityLabel
      }
      accessibilityState={presentation.accessibilityState}
    >
      <View style={presentation.markSlotStyle} {...presentation.hiddenDescendantProps}>
        <TokenMark
          ticker={presentation.markTicker}
          size={presentation.markSize}
          accessibilityLabel="Solana"
          testID={testID ? `${testID}-mark` : undefined}
        />
      </View>
      <Text style={presentation.labelStyle} numberOfLines={1} accessible={false}>
        {presentation.displayLabel}
      </Text>
      {presentation.showCheck ? (
        <View style={presentation.checkSlotStyle} accessible={false}>
          <CorsoIcon
            name={presentation.checkGlyph}
            size={presentation.checkSize}
            color={presentation.checkColor}
          />
        </View>
      ) : (
        <View style={presentation.checkSlotStyle} accessible={false} />
      )}
    </Pressable>
  );
}

import { useState } from 'react';
import { Image, Text, View, type TextStyle } from 'react-native';
import { SvgUri } from 'react-native-svg';
import {
  resolveTokenIcon,
  TOKEN_ICON_IMAGE,
  TOKEN_ICON_SVG,
} from '@/src/features/tokens/tokenIconResolve';
import { resolveTokenMarkPresentation } from '@/src/ui/primitives/tokenMarkPresentation';

const failedUris = new Set<string>();

export function TokenIconImage({
  uri,
  format,
  label,
  textStyle,
  size,
}: {
  uri: string;
  format: number;
  label: string;
  textStyle: TextStyle;
  size: number;
}) {
  const [failed, setFailed] = useState(() => failedUris.has(uri));
  if (failed) {
    return <Text style={textStyle}>{label}</Text>;
  }
  const onError = () => {
    failedUris.add(uri);
    setFailed(true);
  };
  if (format === TOKEN_ICON_SVG) {
    return <SvgUri uri={uri} width={size} height={size} onError={onError} />;
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size }}
      onError={onError}
    />
  );
}

/**
 * One token disc. A fixture image when the resolver has one, otherwise the
 * locked monogram (the TokenMark two-letter disc). Caller URIs are not a prop.
 */
export function TokenIconView({
  symbol,
  mint,
  size,
  accessibilityLabel,
  accessible = true,
  testID,
}: {
  symbol: string;
  mint?: string | null;
  size: number;
  accessibilityLabel: string;
  accessible?: boolean;
  testID?: string;
}) {
  const presented = resolveTokenMarkPresentation({
    ticker: symbol,
    accessibilityLabel,
  });
  const icon = resolveTokenIcon({ mint, symbol: presented.ticker });
  const radius = size / 2;
  const textStyle = {
    ...presented.textStyle,
    fontSize: Math.max(8, Math.round(size * 0.38)),
    lineHeight: Math.max(10, Math.round(size * 0.44)),
  };
  const child =
    icon.kind === TOKEN_ICON_IMAGE ? (
      <TokenIconImage
        uri={icon.uri}
        format={icon.format}
        label={presented.displayLabel}
        textStyle={textStyle}
        size={size}
      />
    ) : (
      <Text style={textStyle}>{presented.displayLabel}</Text>
    );
  return (
    <View
      testID={testID}
      accessible={accessible}
      accessibilityRole={accessible ? presented.accessibilityRole : undefined}
      accessibilityLabel={accessible ? presented.accessibilityLabel : undefined}
      style={{
        ...presented.containerStyle,
        width: size,
        height: size,
        borderRadius: radius,
      }}
    >
      {child}
    </View>
  );
}

import type { ReactNode } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { useInkContrastEnabled } from '@/src/ui/glass/useInkContrast';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import {
  SCREEN_HEADER_BACK_GLYPH,
  SCREEN_HEADER_BACK_GLYPH_SIZE,
  resolveScreenHeader,
  type ScreenHeaderFamily,
} from './screenHeaderPresentation.js';

export type ScreenHeaderProps = {
  /** Left-aligned, beside the back circle. Omitted on the doors that have none. */
  title?: string;
  /** Spoken in place of the title, where the title is a glyph pair (Swap). */
  titleAccessibilityLabel?: string;
  /** The back door. Omitted only when the screen is a root with no way back. */
  onBack?: NonNullable<PressableProps['onPress']>;
  backAccessibilityLabel?: string;
  /**
   * A back door that is closed for a reason — Send disables it while a
   * signature is in flight. The circle stays drawn and dims, because a control
   * that vanishes mid-signing reads as a crash.
   */
  backDisabled?: boolean;
  backGlyph?: typeof SCREEN_HEADER_BACK_GLYPH | 'close';
  /** Replaces the back circle — the Home brand lockup and nothing else. */
  left?: ReactNode;
  right?: ReactNode;
  surfaceInset?: number;
  /** `'desk'` on an Ethena-family screen — see `ScreenHeaderFamily`. */
  family?: ScreenHeaderFamily;
  testID?: string;
};

export function ScreenHeader({
  title,
  titleAccessibilityLabel,
  onBack,
  backAccessibilityLabel,
  backDisabled = false,
  backGlyph = SCREEN_HEADER_BACK_GLYPH,
  left,
  right,
  surfaceInset,
  family,
  testID,
}: ScreenHeaderProps) {
  // The root `InkContrastProvider`'s read of the OS setting — the same signal
  // `Material` answers, without a listener per header.
  const increaseContrast = useInkContrastEnabled();
  const chrome = resolveScreenHeader({
    surfaceInset,
    family,
    increaseContrast,
  });
  return (
    <View style={chrome.rowStyle} testID={testID}>
      {left ?? null}
      {left === undefined && onBack && backAccessibilityLabel ? (
        <Pressable
          onPress={onBack}
          disabled={backDisabled}
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel}
          accessibilityState={{ disabled: backDisabled }}
          style={[chrome.backHitStyle, backDisabled ? { opacity: 0.4 } : null]}
          testID={testID ? `${testID}-back` : undefined}
        >
          <View style={chrome.backCircleStyle}>
            <CorsoIcon
              name={backGlyph}
              size={SCREEN_HEADER_BACK_GLYPH_SIZE}
              color={chrome.backGlyphColor}
            />
          </View>
        </Pressable>
      ) : null}
      {title ? (
        <CorsoText
          style={chrome.titleStyle}
          accessibilityRole="header"
          accessibilityLabel={titleAccessibilityLabel}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </CorsoText>
      ) : null}
      {right ? (
        <>
          <View style={chrome.spacerStyle} />
          {right}
        </>
      ) : null}
    </View>
  );
}

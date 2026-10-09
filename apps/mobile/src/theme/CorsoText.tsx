import { forwardRef } from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { typography } from '@/constants/theme';
import { liftInkColor, resolveSheetInkColor } from '@/src/ui/glass/inkContrast';
import {
  useInkContrastEnabled,
  useOnFloatSheet,
} from '@/src/ui/glass/useInkContrast';

export type CorsoTextProps = TextProps;

export const CORSO_TEXT_DEFAULT_STYLE: TextStyle = {
  /**
   * ⚠️ The cast is the house convention, not a shortcut: React Native's
   * `FontVariant` union omits `slashed-zero` even though the runtime honours
   * it, so every existing slashed-zero call site in the app
   * (`app/receive.tsx`, `app/swap.tsx`, `SwapTokenPickerSheet.tsx`, five more)
   * spells it exactly this way. Diverging here would make this the one file
   * that looks different for no reason.
   */
  fontVariant: [...typography.fontVariantNumerals] as TextStyle['fontVariant'],
};

export const CorsoText = forwardRef<Text, CorsoTextProps>(function CorsoText(
  { style, ...rest },
  ref,
) {
  const increaseContrast = useInkContrastEnabled();
  const onFloatSheet = useOnFloatSheet();
  if (!increaseContrast && !onFloatSheet) {
    return (
      <Text ref={ref} {...rest} style={[CORSO_TEXT_DEFAULT_STYLE, style]} />
    );
  }
  const flat = StyleSheet.flatten([CORSO_TEXT_DEFAULT_STYLE, style]) as
    | TextStyle
    | undefined;
  const color = typeof flat?.color === 'string' ? flat.color : undefined;
  const lifted = onFloatSheet
    ? resolveSheetInkColor(color, increaseContrast)
    : liftInkColor(color, true);
  return (
    <Text
      ref={ref}
      {...rest}
      style={lifted === flat?.color ? flat : { ...flat, color: lifted }}
    />
  );
});

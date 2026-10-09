import { Platform, Text, TextInput, type TextStyle } from 'react-native';
import { typography } from '@/constants/theme';
import { setVariableFaceEnabled } from '@/src/ui/tokens';
import { supportsVariableFontWeights } from './interFonts';
import { mergeFontDefaultStyle } from './mergeFontDefaultStyle';

type WithDefaultProps = {
  defaultProps?: {
    style?: TextStyle | TextStyle[];
  };
};

let installed = false;

export function installDefaultFont(): void {
  if (installed) return;
  installed = true;

  const variable = supportsVariableFontWeights(Platform.OS, Platform.Version);
  setVariableFaceEnabled(variable);
  const family = variable
    ? typography.fontFamilyVariable
    : typography.fontFamily;

  const TextAny = Text as typeof Text & WithDefaultProps;
  const TextInputAny = TextInput as typeof TextInput & WithDefaultProps;

  TextAny.defaultProps = {
    ...TextAny.defaultProps,
    style: mergeFontDefaultStyle(
      family,
      TextAny.defaultProps?.style ?? null,
      typography.fontVariantTabular,
    ) as TextStyle,
  };

  TextInputAny.defaultProps = {
    ...TextInputAny.defaultProps,
    style: mergeFontDefaultStyle(
      family,
      TextInputAny.defaultProps?.style ?? null,
      typography.fontVariantTabular,
    ) as TextStyle,
  };
}

export function __resetDefaultFontInstallForTests(): void {
  installed = false;
}

export function isDefaultFontInstalled(): boolean {
  return installed;
}

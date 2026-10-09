import { copy } from '@/constants/copy';

export function resolveImportWordCellAccessibility(input: {
  /** Zero-based cell index. */
  index: number;
  filled: boolean;
  /** secureTextEntry / masked dots. */
  masked: boolean;
}) {
  const n = input.index + 1;
  // State only — never the mnemonic word (contract: VoiceOver must not speak it).
  let valueText: string = copy.import.wordCellEmpty;
  if (input.filled && input.masked) {
    valueText = copy.import.wordCellSecureEntry;
  } else if (input.filled) {
    valueText = copy.import.wordCellEntered;
  } else if (input.masked) {
    valueText = copy.import.wordCellSecureField;
  }

  return {
    accessibilityLabel: copy.import.wordCellLabel(n),
    accessibilityValue: { text: valueText },
  };
}

export function resolveImportControlAccessibility(input: {
  busy: boolean;
  canImport: boolean;
  ctaLabel: string;
  ctaWorkingLabel: string;
  backLabel: string;
}) {
  const disabled = !input.canImport || input.busy;
  return {
    cta: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: input.busy
        ? input.ctaWorkingLabel
        : input.ctaLabel,
      accessibilityState: {
        busy: input.busy,
        disabled,
      },
    },
    back: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: input.backLabel,
    },
    reveal: {
      accessibilityRole: 'button' as const,
    },
    lengthToggle: {
      accessibilityRole: 'button' as const,
    },
    paste: {
      accessibilityRole: 'button' as const,
    },
    error: {
      accessibilityRole: 'alert' as const,
      accessibilityLiveRegion: 'assertive' as const,
    },
  };
}

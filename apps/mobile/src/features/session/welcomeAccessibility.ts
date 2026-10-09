export function resolveWelcomeLegalAccessibility(input: {
  termsLabel: string;
  privacyLabel: string;
}) {
  return {
    terms: {
      accessibilityRole: 'link' as const,
      accessibilityLabel: input.termsLabel,
    },
    privacy: {
      accessibilityRole: 'link' as const,
      accessibilityLabel: input.privacyLabel,
    },
  };
}

export function resolveWelcomeDoorAccessibility(input: {
  disabled: boolean;
  primaryLabel: string;
}) {
  return {
    primary: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: input.primaryLabel,
      accessibilityState: { disabled: input.disabled },
    },
  };
}


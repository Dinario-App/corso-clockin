/** The accessibility fields a CTA caller may contribute. Role is not one. */
export type CtaAccessibilityProps = {
  accessibilityLabel?: string;
  /** Say WHY, when the label alone cannot: "scroll to the end to continue". */
  accessibilityHint?: string;
  accessibilityState?: {
    disabled?: boolean;
    busy?: boolean;
  };
};

export type ResolvedCtaAccessibility = {
  accessibilityRole: 'button';
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityState: { disabled: boolean; busy: boolean };
};

export function resolveCtaAccessibility(input: {
  /** The visible label — the last-resort announcement. */
  label: string;
  /** The component's own `accessibilityLabel` prop, if the caller set one. */
  accessibilityLabel?: string;
  accessibility?: CtaAccessibilityProps;
  /** The component's resolved interaction state. */
  disabled: boolean;
  busy: boolean;
}): ResolvedCtaAccessibility {
  const spread = input.accessibility;
  const label =
    normalizeLabel(spread?.accessibilityLabel) ??
    normalizeLabel(input.accessibilityLabel) ??
    input.label;
  const hint = normalizeLabel(spread?.accessibilityHint);

  return {
    accessibilityRole: 'button',
    accessibilityLabel: label,
    ...(hint === undefined ? {} : { accessibilityHint: hint }),
    accessibilityState: {
      disabled: input.disabled || spread?.accessibilityState?.disabled === true,
      busy: input.busy || spread?.accessibilityState?.busy === true,
    },
  };
}

/** An empty or whitespace-only announcement is worse than none: ignore it. */
function normalizeLabel(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

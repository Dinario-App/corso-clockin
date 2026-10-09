export const MIN_TAP_TARGET_PT = 44;

export type TapTargetInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type TapTargetPresentationInput = {
  visualWidth: unknown;
  visualHeight: unknown;
};

function assertPositiveFiniteDimension(
  value: unknown,
  axis: 'visualWidth' | 'visualHeight',
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`TapTarget ${axis} must be a positive finite number`);
  }
  return value;
}

function symmetricInsetForDeficit(deficit: number): number {
  if (deficit <= 0) {
    return 0;
  }
  return Math.ceil(deficit / 2);
}

/**
 * Pure symmetric hit-area expansion for invisible TapTarget wrappers.
 * Effective touch size is never below MIN_TAP_TARGET_PT on either axis.
 */
export function resolveTapTargetInsets(
  input: TapTargetPresentationInput,
): TapTargetInsets {
  const visualWidth = assertPositiveFiniteDimension(
    input.visualWidth,
    'visualWidth',
  );
  const visualHeight = assertPositiveFiniteDimension(
    input.visualHeight,
    'visualHeight',
  );

  const horizontalInset = symmetricInsetForDeficit(
    MIN_TAP_TARGET_PT - visualWidth,
  );
  const verticalInset = symmetricInsetForDeficit(
    MIN_TAP_TARGET_PT - visualHeight,
  );

  return {
    top: verticalInset,
    bottom: verticalInset,
    left: horizontalInset,
    right: horizontalInset,
  };
}

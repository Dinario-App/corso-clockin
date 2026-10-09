export type RampAsset = 'SOL' | 'USDC';

export type RampFlags = {
  /** Master Buy kill switch (API FLAG_RAMP → flags.rampEnabled). */
  rampEnabled: boolean;
  /**
   * USDC Buy (API FLAG_RAMP && FLAG_RAMP_USDC → flags.rampUsdcEnabled).
   * Mobile never invents enablement; false / missing is fail-closed.
   */
  rampUsdcEnabled: boolean;
};

export const BOUNDED_RAMP_ASSETS: readonly RampAsset[] = ['SOL', 'USDC'] as const;

export function isBoundedRampAsset(value: unknown): value is RampAsset {
  return value === 'SOL' || value === 'USDC';
}

/**
 * SOL when rampEnabled; USDC only when both flags allow it.
 * Never infers provider codes or falls back USDC → SOL silently for the request —
 * this only decides which selector options exist.
 */
export function availableRampAssets(flags: RampFlags): RampAsset[] {
  if (!flags.rampEnabled) return [];
  const assets: RampAsset[] = ['SOL'];
  if (flags.rampUsdcEnabled) {
    assets.push('USDC');
  }
  return assets;
}

export function isRampAssetSelectable(
  asset: RampAsset,
  flags: RampFlags,
): boolean {
  return availableRampAssets(flags).includes(asset);
}

/** First available asset, or null when Buy is fully off. */
export function defaultRampAsset(flags: RampFlags): RampAsset | null {
  return availableRampAssets(flags)[0] ?? null;
}

/**
 * Keep selection if still allowed; otherwise clamp to default available asset.
 * Returns null only when nothing is available.
 */
export function clampRampAsset(
  selected: RampAsset | null,
  flags: RampFlags,
): RampAsset | null {
  if (selected && isRampAssetSelectable(selected, flags)) {
    return selected;
  }
  return defaultRampAsset(flags);
}

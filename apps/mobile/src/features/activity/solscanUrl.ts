/** Solscan URL for a signature (cluster-aware). Presentation for Transaction. */
export function solscanSignatureUrl(
  signature: string,
  cluster: 'devnet' | 'mainnet-beta',
): string {
  const base = `https://solscan.io/tx/${encodeURIComponent(signature)}`;
  if (cluster === 'mainnet-beta') return base;
  return `${base}?cluster=${cluster}`;
}

export const interFontMap = {
  InterVariable: require('../../assets/fonts/InterVariable.ttf'),
  Inter: require('../../assets/fonts/Inter-Regular.ttf'),
  'Inter-Medium': require('../../assets/fonts/Inter-Medium.ttf'),
  'Inter-SemiBold': require('../../assets/fonts/Inter-SemiBold.ttf'),
  'Inter-Bold': require('../../assets/fonts/Inter-Bold.ttf'),
  'Inter-Black': require('../../assets/fonts/Inter-Black.ttf'),
  SpaceMono: require('../../assets/fonts/SpaceMono-Regular.ttf'),
  /**
   * The Sign in with Google label only: Google's guidelines specify Google
   * Sans Medium. Unmodified official release file, SIL OFL 1.1 —
   * `GoogleSans-PROVENANCE.txt`.
   */
  'GoogleSans-Medium': require('../../assets/fonts/GoogleSans-Medium.ttf'),
} as const;

export type InterFontMapKey = keyof typeof interFontMap;

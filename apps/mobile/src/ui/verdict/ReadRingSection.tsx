import { StyleSheet } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { colors, typography } from '@/src/ui/tokens';
import type { ReadRingView } from '@/src/features/tokenVitals/readRingCatalog';
import { CheckGrid } from './CheckGrid';
import { READ_RING_CARD as R } from './readRingPresentation';
import { canonWeight } from './verdictCardPresentation';

export function ReadRingSection({ ring }: { ring: ReadRingView | null }) {
  /**
   * The ONE resolution, and it never leaves this function. `null` is the
   * no-catalog fallback and a ring with nothing to say — neither half, so the
   * section draws nothing at all.
   */
  const coverage = resolveCoverage(ring);
  if (coverage === null) return null;

  return (
    <>
      <CorsoText style={styles.coverage}>{coverage.line}</CorsoText>
      <CheckGrid cells={coverage.cells} />
    </>
  );
}

function resolveCoverage(
  ring: Pick<ReadRingView, 'coverageLine' | 'cells'> | null,
): { line: string; cells: ReadRingView['cells'] } | null {
  if (ring === null) return null;
  const line = ring.coverageLine.trim();
  if (line.length === 0) return null;
  return { line, cells: ring.cells };
}

const styles = StyleSheet.create({
  /** "N of 8 checks read" — the coverage, 13 `grey1`, above the cells it counts. */
  coverage: {
    fontSize: R.coverageSize,
    lineHeight: R.coverageLineHeight,
    fontFamily: typography.face('400'),
    fontWeight: canonWeight('400'),
    color: colors.inkSecondary,
    marginBottom: 2,
  },
});

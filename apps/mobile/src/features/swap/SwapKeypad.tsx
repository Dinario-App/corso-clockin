import { Pressable, StyleSheet, View } from 'react-native';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { ONGLASS_HI } from '@/src/ui/glass/materialTokens';
import { colors, radii, typography } from '@/src/ui/tokens';
import {
  SWAP_KEYPAD_COLUMNS,
  SWAP_KEYPAD_KEYS,
  type SwapKeypadKey,
  type SwapKeypadKeyId,
} from './swapKeypadPresentation';

export type SwapKeypadProps = {
  /** One press, one key id. The caller owns the string (`applySwapKeypadKey`). */
  onKey: (key: SwapKeypadKeyId) => void;
  disabled?: boolean;
  testID?: string;
};

export function SwapKeypad({
  onKey,
  disabled = false,
  testID,
}: SwapKeypadProps) {
  const rows: SwapKeypadKey[][] = [];
  for (let i = 0; i < SWAP_KEYPAD_KEYS.length; i += SWAP_KEYPAD_COLUMNS) {
    rows.push(SWAP_KEYPAD_KEYS.slice(i, i + SWAP_KEYPAD_COLUMNS));
  }

  return (
    <View
      style={styles.keypad}
      testID={testID}
      accessibilityLabel={copy.trading.keypad.label}
    >
      {rows.map((row) => (
        <View key={row[0].id} style={styles.keyRow}>
          {row.map((spec) => (
            <Key key={spec.id} spec={spec} disabled={disabled} onKey={onKey} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Digits speak themselves; the two `.key.fn` glyphs need a name. */
function accessibleName(key: SwapKeypadKey): string {
  if (key.id === 'decimal') return copy.trading.keypad.decimal;
  if (key.id === 'delete') return copy.trading.keypad.delete;
  return key.glyph;
}

function Key({
  spec,
  disabled,
  onKey,
}: {
  spec: SwapKeypadKey;
  disabled: boolean;
  onKey: (key: SwapKeypadKeyId) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.key,
        pressed && !disabled ? styles.keyPressed : null,
      ]}
      disabled={disabled}
      onPress={() => onKey(spec.id)}
      accessibilityRole="button"
      accessibilityLabel={accessibleName(spec)}
      accessibilityState={{ disabled }}
      testID={`swap-keypad-${spec.id}`}
    >
      <CorsoText
        style={[
          styles.keyGlyph,
          spec.kind === 'fn' ? styles.keyGlyphFn : null,
          disabled ? styles.keyGlyphDisabled : null,
        ]}
      >
        {spec.glyph}
      </CorsoText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  keypad: {
    alignSelf: 'stretch',
    paddingTop: 8,
    gap: 2,
  },
  keyRow: {
    flexDirection: 'row',
    gap: 2,
  },
  key: {
    flex: 1,
    paddingVertical: 15,
    minHeight: 44,
    borderRadius: radii.modelRow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** `.key:active` — the wash is the only paint a key ever carries. */
  keyPressed: {
    backgroundColor: ONGLASS_HI,
  },
  keyGlyph: {
    color: colors.ink,
    fontSize: 20,
    fontFamily: typography.face('400'),
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  /** `.key.fn` — the point and the delete glyph recede to `--ink48`. */
  keyGlyphFn: {
    color: colors.inkTertiary,
  },
  keyGlyphDisabled: {
    color: colors.inkQuaternary,
  },
});

import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import {
  EthenaGround,
  EthenaPill,
} from '@/src/ui/ethena/EthenaPrimitives';

export function ReviewShellCanvas({ children }: { children?: ReactNode }) {
  return (
    <SafeAreaView style={styles.canvas} edges={['top', 'bottom']}>
      {children}
    </SafeAreaView>
  );
}

export type SwapGateDoor = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

/**
 * A gate screen: optional title, optional body, optional spinner, and its
 * doors stacked at the floor in the order given.
 */
export function SwapGate({
  testID,
  title,
  body,
  busy = false,
  doors,
}: {
  testID: string;
  title?: string;
  body?: string;
  busy?: boolean;
  doors: readonly SwapGateDoor[];
}) {
  return (
    <EthenaGround>
      <SafeAreaView
        testID={testID}
        style={styles.gate}
        edges={['top', 'bottom']}
      >
        <StatusBar style="light" />
        <View style={styles.pad}>
          {busy ? (
            <ActivityIndicator
              testID={`${testID}-busy`}
              color={ethena.ink.primary}
              style={styles.spinner}
            />
          ) : null}
          {title ? (
            <CorsoText style={styles.title} accessibilityRole="header">
              {title}
            </CorsoText>
          ) : null}
          {body ? <CorsoText style={styles.body}>{body}</CorsoText> : null}
        </View>
        <View style={styles.doors}>
          {doors.map((door, index) => (
            <View key={`${index}-${door.label}`}>
              <EthenaPill
                testID={`${testID}-door-${index}`}
                label={door.label}
                plane="floatAction"
                onPress={door.onPress}
                accessibilityLabel={door.accessibilityLabel}
                style={styles.door}
              />
            </View>
          ))}
        </View>
      </SafeAreaView>
    </EthenaGround>
  );
}

/**
 * The two danger-acknowledgement doors inside Review. Neither signs: one
 * closes Review, the other only reveals the commit row, so both are the
 * float-glass peer and never icy.
 */
export function ReviewShellDoors({
  testID,
  doors,
}: {
  testID: string;
  doors: readonly SwapGateDoor[];
}) {
  return (
    <View style={styles.inlineDoors}>
      {doors.map((door, index) => (
        <View key={`${index}-${door.label}`}>
          <EthenaPill
            testID={`${testID}-${index}`}
            label={door.label}
            plane="floatAction"
            onPress={door.onPress}
            accessibilityLabel={door.accessibilityLabel}
            style={styles.door}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * Text that `swap.tsx` hands to `ReviewSign` as children. Solid ink on the
 * void, in the Ethena ladder: primary for a statement, mute for a footnote.
 */
export const reviewShellText = StyleSheet.create({
  block: {
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: ethenaGeometry.gap,
    gap: 12,
  },
  /** A line that sits in `ReviewSign`'s scroll column on its own, not in `block`. */
  inset: { paddingHorizontal: ethenaGeometry.gutter, paddingTop: 12 },
  statement: { ...ETHENA_TYPE.body, color: ethena.ink.primary },
  /** A refusal the reader must see: footnote size, primary ink. */
  alert: { ...ETHENA_TYPE.rowSub, color: ethena.ink.primary },
  footnote: { ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary },
  /**
   * Also the Jupiter attribution lines (cl. 2.3 / cl. 8.4 say "prominently"):
   * the secondary step, never `ink3`. Greying it to tertiary would be the cheap
   * way to fail that word.
   */
  footnoteSpaced: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.secondary,
    marginTop: 8,
  },
  feeLines: { gap: 4, paddingVertical: 4 },
});

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: ethena.void },
  gate: { flex: 1 },
  pad: {
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 52,
    gap: 12,
    alignItems: 'flex-start',
  },
  spinner: { alignSelf: 'flex-start' },
  title: { ...ETHENA_TYPE.title, color: ethena.ink.primary },
  body: { ...ETHENA_TYPE.body, color: ethena.ink.secondary },
  doors: {
    marginTop: 'auto',
    paddingHorizontal: ethenaGeometry.gutter,
    paddingBottom: 8,
    gap: 12,
  },
  inlineDoors: { gap: 12, paddingTop: 12 },
  door: { flex: undefined, alignSelf: 'stretch' },
});

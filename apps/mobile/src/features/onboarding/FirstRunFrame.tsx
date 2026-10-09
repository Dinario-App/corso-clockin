import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QUIET_GUTTER } from '@/src/ui/quiet/quietMarkPresentation';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { ethena } from '@/constants/theme.ethena';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';

export type FirstRunFrameProps = {
  title: string;
  subtitle?: string;
  /** Artboard y of the title: 02 = 120, 03 = 100, 04 = 140 (less the 47 status inset). */
  titleTop: number;
  children?: ReactNode;
  footer: ReactNode;
};

export function FirstRunFrame({
  title,
  subtitle,
  titleTop,
  children,
  footer,
}: FirstRunFrameProps) {
  return (
    <EthenaGround>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>
        <View style={[styles.body, { paddingTop: titleTop }]}>
          <CorsoText accessibilityRole="header" style={styles.title}>
            {title}
          </CorsoText>
          {subtitle ? (
            <CorsoText style={styles.subtitle}>{subtitle}</CorsoText>
          ) : null}
          {children}
        </View>
        <View style={styles.floor}>{footer}</View>
      </SafeAreaView>
    </EthenaGround>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: QUIET_GUTTER },
  title: {
    ...ETHENA_TYPE.title,
    textAlign: 'center',
    color: ethena.ink.primary,
  },
  subtitle: {
    ...ETHENA_TYPE.sub,
    marginTop: 8,
    textAlign: 'center',
    color: ethena.ink.secondary,
  },
  floor: {
    paddingHorizontal: QUIET_GUTTER,
    paddingBottom: 24,
    gap: 12,
  },
});

import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderRow } from '@/src/ui/navigation/HeaderRow';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { colors, spacing } from '@/src/ui/tokens';

export type BotsScreenProps = {
  title: string;
  onBackPress: () => void;
  backAccessibilityLabel: string;
  backDisabled?: boolean;
  testID?: string;
  /** Pinned under the scroller — the fleet dock. Outside the fades on purpose. */
  dock?: ReactNode;
  refreshControl?: ScrollViewProps['refreshControl'];
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  contentTestID?: string;
  children: ReactNode;
};

export function BotsScreen(props: BotsScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <HeaderRow
        left="back-chevron"
        onBackPress={props.onBackPress}
        backAccessibilityLabel={props.backAccessibilityLabel}
        backDisabled={props.backDisabled}
        right="none"
        title={props.title}
        testID={props.testID}
      />
      <View style={styles.scrollWrap}>
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={props.refreshControl}
          keyboardShouldPersistTaps={props.keyboardShouldPersistTaps}
          showsVerticalScrollIndicator={false}
          testID={props.contentTestID}
        >
          {props.children}
        </ScrollView>
        <ScrollEdgeFade color={colors.canvas} />
      </View>
      {props.dock}
    </SafeAreaView>
  );
}

/** The screen gutter, exported so a full-bleed child can re-inset itself. */
export const BOTS_GUTTER = spacing.gutter;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scrollWrap: { flex: 1, position: 'relative' },
  body: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.smd,
    paddingBottom: spacing.xl,
  },
});

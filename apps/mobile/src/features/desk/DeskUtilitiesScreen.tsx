import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { CorsoGlass } from '@/src/ui/glass/CorsoGlass';
import { ScreenHeader } from '@/src/ui/navigation/ScreenHeader';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import {
  SCROLL_FADE_BOTTOM,
  SCROLL_FADE_TOP,
  resolveDockedListEdge,
} from '@/src/ui/primitives/scrollEdgeFadePresentation';
import { DESK_UTILITY_SECTIONS } from './deskUtilitiesPresentation';

export function DeskUtilitiesScreen({ back }: { back?: ReactNode } = {}) {
  const insets = useSafeAreaInsets();
  const edge = resolveDockedListEdge({
    bottomReserve: insets.bottom,
    fadeBottom: SCROLL_FADE_BOTTOM,
    clearance: 24,
  });
  const text = copy.deskUtilities;

  return (
    <EthenaGround>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader family="desk" left={back ?? null} title={text.title} />
        <CorsoText style={styles.lead}>{text.lead}</CorsoText>
        <View
          style={[styles.status, styles.leadStatus]}
          testID="desk-utilities-preview"
        >
          <View style={styles.statusDot} />
          <CorsoText style={styles.statusLabel}>{text.notLive}</CorsoText>
        </View>
        <View style={styles.scroller}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.canvas,
              { paddingBottom: edge.paddingBottom },
            ]}
            contentInsetAdjustmentBehavior="never"
            testID="desk-utilities"
          >
            <View style={styles.list}>
              {DESK_UTILITY_SECTIONS.map((section) => (
                <CorsoGlass
                  key={section.key}
                  material="ground-tray"
                  radius={ethenaGeometry.radiusBox}
                  testID={`desk-utilities-${section.key}`}
                >
                  <View style={styles.card}>
                    <View style={styles.cardHead}>
                      <CorsoText
                        style={styles.cardTitle}
                        accessibilityRole="header"
                      >
                        {section.title}
                      </CorsoText>
                      {section.optional ? (
                        <CorsoText style={styles.tag}>
                          {text.optional}
                        </CorsoText>
                      ) : null}
                    </View>
                    <CorsoText style={styles.cardBody}>
                      {section.body}
                    </CorsoText>
                  </View>
                </CorsoGlass>
              ))}
            </View>

            <CorsoText style={styles.footnote}>{text.footnote}</CorsoText>
          </ScrollView>
          <ScrollEdgeFade
            top={SCROLL_FADE_TOP}
            bottom={edge.fadeBottom}
            color={ethena.groundStops[0][1]}
            testID="desk-utilities-scroll-fade"
          />
        </View>
      </SafeAreaView>
    </EthenaGround>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroller: { flex: 1, position: 'relative' },
  canvas: { paddingHorizontal: ethenaGeometry.gutter },
  lead: {
    ...ETHENA_TYPE.body,
    color: ethena.ink.tertiary,
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 8,
  },
  list: { gap: 12, marginTop: SCROLL_FADE_TOP },
  card: { padding: 16, gap: 8 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    ...ETHENA_TYPE.cardHeading,
    flexShrink: 1,
    color: ethena.ink.primary,
  },
  tag: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.tertiary,
    fontWeight: '500',
  },
  cardBody: {
    ...ETHENA_TYPE.body,
    color: ethena.ink.secondary,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  /** Under the lead, on the lead's gutter. */
  leadStatus: {
    paddingHorizontal: ethenaGeometry.gutter,
    marginTop: 8,
  },
  /** A hollow ring, ink-tertiary: off, never a live or azure signal. */
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: ethena.ink.tertiary,
  },
  statusLabel: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.tertiary,
    fontWeight: '500',
  },
  footnote: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.tertiary,
    marginTop: 24,
  },
});

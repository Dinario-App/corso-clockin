import type { ComponentProps, ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { ethena } from '@/constants/theme.ethena';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { HomeBook } from '@/src/ui/ethena/screens/HomeBook';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import { DeskStripSlot } from '@/src/features/why/WhyViews';
import {
  SCROLL_FADE_BOTTOM,
  resolveDockedListEdge,
} from '@/src/ui/primitives/scrollEdgeFadePresentation';

export function BookScreen({
  topInset,
  dockReserve,
  belowBook,
  refreshing = false,
  onRefresh,
  ...book
}: Omit<ComponentProps<typeof HomeBook>, 'chrome'> & {
  /** The phone's status-bar inset. */
  topInset: number;
  /** `resolveTabBarPresentation(...).reserve` — the dock's full height. */
  dockReserve: number;
  belowBook?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const scrollFade = useScrollLinkedFadeTop();
  const edge = resolveDockedListEdge({
    bottomReserve: dockReserve,
    fadeBottom: SCROLL_FADE_BOTTOM,
    clearance: 16,
  });
  return (
    <EthenaGround>
      <View style={{ flex: 1, paddingTop: topInset }}>
        <View style={{ flex: 1 }}>
        <ScrollView
          {...scrollFade.scroller}
          testID="home-book"
          contentContainerStyle={{ paddingBottom: edge.paddingBottom }}
          contentInsetAdjustmentBehavior="never"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={ethena.ink.primary}
                colors={[ethena.ink.primary]}
                progressBackgroundColor={ethena.crest}
              />
            ) : undefined
          }
        >
          <HomeBook {...book} chrome="route" />
          <DeskStripSlot />
          {belowBook}
        </ScrollView>
        <ScrollEdgeFade
          top={scrollFade.top}
          bottom={0}
          color={ethena.groundStops[0][1]}
          testID="home-book-fade-top"
        />
        <ScrollEdgeFade
          top={0}
          bottom={edge.fadeBottom}
          color={ethena.void}
          testID="home-book-fade-bottom"
        />
        </View>
      </View>
    </EthenaGround>
  );
}

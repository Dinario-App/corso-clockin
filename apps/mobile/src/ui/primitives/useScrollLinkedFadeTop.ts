import { useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { resolveBottomSheetBodyFadeTop } from './bottomSheetPresentation';
import {
  SCROLL_FADE_TOP,
  type ScrollLinkedFadeDepth,
} from './scrollEdgeFadePresentation';

type Linked = {
  top: ScrollLinkedFadeDepth;
  scroller: {
    scrollEventThrottle: number;
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  };
};

function createLinked(): Linked {
  const listeners = new Set<(depth: number) => void>();
  const top: ScrollLinkedFadeDepth = {
    current: 0,
    max: SCROLL_FADE_TOP,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    top,
    scroller: {
      scrollEventThrottle: 16,
      onScroll(event) {
        const next = resolveBottomSheetBodyFadeTop(
          event.nativeEvent.contentOffset.y,
        );
        if (next === top.current) return;
        top.current = next;
        for (const listener of listeners) listener(next);
      },
    },
  };
}

export function useScrollLinkedFadeTop(): Linked {
  const linked = useRef<Linked | null>(null);
  linked.current ??= createLinked();
  return linked.current;
}

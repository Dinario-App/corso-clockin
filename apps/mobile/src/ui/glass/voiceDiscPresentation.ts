import { copy } from '@/constants/copy';
import { typography } from '@/src/ui/tokens';
import { GLASS_EDGE, GLASS_EDGE_LIVE } from './glassTokens';

export const VOICE_DISC_SIZE = typography.ask;
export const VOICE_BAR_WIDTH = 3;
export const VOICE_BAR_GAP = 3;
export const VOICE_BARS_IDLE = [10, 20, 14, 22, 9] as const;
export const VOICE_BARS_LISTENING = [16, 28, 20, 30, 14] as const;

export type VoiceDiscPresentation = {
  size: number;
  barHeights: readonly number[];
  /** Bars breathe while listening — unless Reduce Motion, then they hold. */
  animate: boolean;
  edgeColor: string;
  accessibilityLabel: string;
  accessibilityState: { selected: boolean };
};

export function resolveVoiceDiscPresentation(input: {
  listening: boolean;
  reduceMotion: boolean;
}): VoiceDiscPresentation {
  return {
    size: VOICE_DISC_SIZE,
    barHeights: input.listening ? VOICE_BARS_LISTENING : VOICE_BARS_IDLE,
    animate: input.listening && !input.reduceMotion,
    edgeColor: input.listening ? GLASS_EDGE_LIVE : GLASS_EDGE,
    accessibilityLabel: input.listening
      ? copy.live.voiceStopA11y
      : copy.live.voiceA11y,
    accessibilityState: { selected: input.listening },
  };
}

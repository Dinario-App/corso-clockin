import type { TextStyle } from 'react-native';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';

export const PROFILE_GUTTER = ethenaGeometry.gutter;

export const PROFILE_DOWN = '#D2776B';
export const PROFILE_UP = '#7FB88A';

export const PROFILE_STACK_GAP = 12;
export const PROFILE_DANGER_GAP = 34;
/** The shipped danger glyph size (`ACCOUNT_DANGER_GLYPH_SIZE`). */
export const PROFILE_DANGER_GLYPH = 15;
export const PROFILE_COPY_FLASH_MS = 1600;
export const PROFILE_WELL = 34;
export const PROFILE_ROW = {
  wellRadius: 10,
  padV: 12,
  padH: 14,
  gap: 12,
  /** The glyph inside the well. The frames draw a 15pt placeholder glyph. */
  wellGlyph: 16,
  chevron: 16,
} as const;

export const profileRootType = {
  title: {
    color: ethena.ink.primary,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '600',
  },
  heading: {
    color: ethena.ink3,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
  },
  rowLabel: {
    color: ethena.ink.primary,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
  },
  rowSub: {
    color: ethena.mute,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '400',
  },
  /** The name row's value (`My money`) — mute, the row's secondary read. */
  rowValue: {
    color: ethena.mute,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '400',
    textAlign: 'right',
    flexShrink: 1,
  },
  identityName: {
    color: ethena.ink.primary,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '600',
  },
  address: {
    color: ethena.mute,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '400',
  },
  /** The `copied ✓` flash — a real confirmation, in `--up`. */
  addressCopied: {
    color: PROFILE_UP,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  dangerLabel: {
    color: PROFILE_DOWN,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '600',
  },
  dangerNote: {
    color: ethena.ink3,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '400',
  },
} as const satisfies Record<string, TextStyle>;

/**
 * `ProfileRootPane`'s own style: rows carry their own horizontal padding, so
 * the tray's is zeroed. Every pane style is spread over this.
 */
export const PROFILE_ROOT_PANE_BASE = {
  paddingHorizontal: 0,
  overflow: 'hidden',
} as const;

export const ACCOUNT_IDENTITY_CARD_STYLE = {
  paddingHorizontal: ethenaGeometry.pad,
  paddingVertical: ethenaGeometry.pad,
  gap: 4,
} as const;

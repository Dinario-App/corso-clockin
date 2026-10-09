export const SHEET_SPRING = Object.freeze({
  damping: 26,
  stiffness: 260,
  mass: 1,
  overshootClamping: true,
});

export const SHEET_SPRING_OFFSET = 64;

export function resolveSheetSpringPresentation(input: {
  visible: boolean;
  reduceMotion: boolean;
}): { animated: boolean; startProgress: 0 | 1 } {
  const animated = input.visible && !input.reduceMotion;
  return {
    animated,
    startProgress: animated ? 1 : 0,
  };
}

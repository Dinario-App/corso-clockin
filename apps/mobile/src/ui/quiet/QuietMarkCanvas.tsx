import { useId } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, G, RadialGradient, Stop } from 'react-native-svg';
import {
  QUIET_VOID,
  QUIET_WELL_STOPS,
  resolveBloomGlow,
  resolveQuietCanvas,
  resolveQuietFrameTransform,
  type QuietCanvasVariant,
} from './quietMarkPresentation';

export type QuietMarkCanvasProps = {
  variant: QuietCanvasVariant;
};

export function QuietMarkCanvas({ variant }: QuietMarkCanvasProps) {
  const window = useWindowDimensions();
  const frame = resolveQuietFrameTransform(window);
  const canvas = resolveQuietCanvas(variant);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const { well } = canvas;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: QUIET_VOID }]}
    >
      <Svg width={window.width} height={window.height}>
        <Defs>
          <RadialGradient
            id={`quiet-well-${uid}`}
            cx={well.x}
            cy={well.y}
            r={well.size}
            fx={well.x}
            fy={well.y}
            gradientUnits="userSpaceOnUse"
          >
            {QUIET_WELL_STOPS.map((stop) => (
              <Stop
                key={stop.offset}
                offset={stop.offset}
                stopColor={stop.color}
              />
            ))}
          </RadialGradient>
          {canvas.blooms.map((bloom, index) => {
            const glow = resolveBloomGlow(bloom);
            return (
              <RadialGradient
                key={`g${bloom.size}`}
                id={`quiet-bloom-${uid}-${index}`}
                cx={glow.gx}
                cy={glow.gy}
                r={glow.r}
                fx={glow.gx}
                fy={glow.gy}
                gradientUnits="userSpaceOnUse"
              >
                {glow.stops.map((stop) => (
                  <Stop
                    key={stop.offset}
                    offset={stop.offset}
                    stopColor={stop.color}
                    stopOpacity={stop.opacity}
                  />
                ))}
              </RadialGradient>
            );
          })}
        </Defs>
        <G
          transform={`translate(${frame.dx} ${frame.dy}) scale(${frame.scale})`}
        >
          <Circle
            cx={well.x + well.size / 2}
            cy={well.y + well.size / 2}
            r={well.size / 2}
            fill={`url(#quiet-well-${uid})`}
          />
          {canvas.blooms.map((bloom, index) => {
            const glow = resolveBloomGlow(bloom);
            return (
              <Circle
                key={`b${bloom.size}`}
                cx={glow.cx}
                cy={glow.cy}
                r={glow.extent}
                fill={`url(#quiet-bloom-${uid}-${index})`}
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

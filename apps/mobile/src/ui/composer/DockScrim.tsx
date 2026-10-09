import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  COMPOSER_DOCK_GUTTER,
  COMPOSER_DOCK_SCRIM_BLEED,
  COMPOSER_DOCK_SCRIM_COLORS,
  COMPOSER_DOCK_SCRIM_LOCATIONS,
} from './composerPresentation';

export type DockScrimProps = {
  testID?: string;
};

export function DockScrim({ testID }: DockScrimProps) {
  return (
    <View style={styles.box} pointerEvents="none" testID={testID}>
      <LinearGradient
        colors={COMPOSER_DOCK_SCRIM_COLORS}
        locations={COMPOSER_DOCK_SCRIM_LOCATIONS}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    top: 0,
    left: -COMPOSER_DOCK_GUTTER,
    right: -COMPOSER_DOCK_GUTTER,
    bottom: -COMPOSER_DOCK_SCRIM_BLEED,
  },
});

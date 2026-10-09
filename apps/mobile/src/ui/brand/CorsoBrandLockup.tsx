import { View } from 'react-native';
import { CorsoWordmark } from '@/src/ui/brand/CorsoWordmark';
import { resolveCorsoBrandLockupPresentation } from '@/src/ui/brand/corsoBrandLockupPresentation.js';

export type CorsoBrandLockupProps = {
  testID?: string;
};

export function CorsoBrandLockup({ testID }: CorsoBrandLockupProps) {
  const presentation = resolveCorsoBrandLockupPresentation();

  return (
    <View testID={testID} style={presentation.containerStyle}>
      <CorsoWordmark />
    </View>
  );
}

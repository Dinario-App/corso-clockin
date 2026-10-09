import { View } from 'react-native';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import {
  resolveResultMarkPresentation,
  type ResultMarkKind,
} from '@/src/ui/state/resultMarkPresentation.js';

export type ResultMarkProps = {
  kind: ResultMarkKind;
  testID?: string;
};

export function ResultMark({ kind, testID }: ResultMarkProps) {
  const presentation = resolveResultMarkPresentation(kind);

  return (
    <View
      testID={testID}
      accessibilityElementsHidden={presentation.accessibilityElementsHidden}
      importantForAccessibility={presentation.importantForAccessibility}
      style={{
        width: presentation.width,
        height: presentation.height,
        borderRadius: presentation.borderRadius,
        backgroundColor: presentation.backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CorsoIcon
        name={presentation.iconName}
        size={presentation.glyphSize}
        color={presentation.glyphColor}
      />
    </View>
  );
}

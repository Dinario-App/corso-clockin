import { Text, View } from 'react-native';
import { resolveActivityDayHeaderPresentation } from '@/src/ui/activity/activityDayHeaderPresentation.js';

export type ActivityDayHeaderProps = {
  /** Non-empty day-group label — e.g. `Today`, `Yesterday`, `12 Aug`. */
  label: string;
  testID?: string;
};

export function ActivityDayHeader({ label, testID }: ActivityDayHeaderProps) {
  const presentation = resolveActivityDayHeaderPresentation({ label });

  return (
    <View testID={testID} style={presentation.containerStyle}>
      <Text
        style={presentation.labelStyle}
        accessibilityRole={presentation.accessibilityRole}
        accessibilityLabel={presentation.accessibilityLabel}
      >
        {presentation.labelText}
      </Text>
    </View>
  );
}

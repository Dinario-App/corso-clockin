import { Pressable, View } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon.js';
import {
  resolveActivityRowPresentation,
  type ActivityRowStatus,
  type ActivityRowType,
} from '@/src/ui/activity/activityRowPresentation.js';

export type ActivityRowProps = {
  type: ActivityRowType;
  status: ActivityRowStatus;
  title: string;
  counterparty: string;
  time: string;
  signedAmount: string;
  onPress?: () => void;
  testID?: string;
};

export function ActivityRow({
  type,
  status,
  title,
  counterparty,
  time,
  signedAmount,
  onPress,
  testID,
}: ActivityRowProps) {
  const presentation = resolveActivityRowPresentation({
    type,
    status,
    title,
    counterparty,
    time,
    signedAmount,
  });

  return (
    <Pressable
      testID={testID}
      style={presentation.containerStyle}
      accessibilityRole={presentation.accessibilityRole}
      accessibilityLabel={presentation.accessibilityLabel}
      onPress={onPress}
    >
      <View style={presentation.iconWrapStyle} accessible={false}>
        <CorsoIcon
          name={presentation.iconName}
          size={presentation.iconSize}
          color={presentation.iconColor}
        />
      </View>
      <View style={presentation.contentStyle} accessible={false}>
        <CorsoText style={presentation.titleStyle} numberOfLines={1} accessible={false}>
          {presentation.titleText}
        </CorsoText>
        <CorsoText style={presentation.metaStyle} numberOfLines={1} accessible={false}>
          {presentation.metaText}
        </CorsoText>
      </View>
      <View style={presentation.rightStyle} accessible={false}>
        <CorsoText style={presentation.amountStyle} numberOfLines={1} accessible={false}>
          {presentation.amountText}
        </CorsoText>
        <View style={presentation.statusRowStyle} accessible={false}>
          <CorsoIcon
            name={presentation.statusIconName}
            size={presentation.statusIconSize}
            color={presentation.statusIconColor}
          />
          <CorsoText style={presentation.statusStyle} numberOfLines={1} accessible={false}>
            {presentation.statusText}
          </CorsoText>
        </View>
      </View>
    </Pressable>
  );
}

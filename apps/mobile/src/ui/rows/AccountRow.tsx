import {
  Pressable,
  View,
  type PressableProps,
  type SwitchProps as NativeSwitchProps,
} from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { Switch } from '@/src/ui/controls/Switch.js';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon.js';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames.js';
import {
  resolveAccountRowPresentation,
  type AccountRowAccessory,
  type AccountRowFamily,
} from '@/src/ui/rows/accountRowPresentation.js';

type AccountRowBaseProps = {
  glyph: CorsoIconName;
  label: string;
  sub?: string;
  disabled?: boolean;
  last?: boolean;
  onPress?: PressableProps['onPress'];
  accessibilityLabel?: string;
  testID?: string;
  /** `'desk'` on a tray on the desk ground — see `AccountRowFamily`. */
  family?: AccountRowFamily;
};

type AccountRowChevronProps = AccountRowBaseProps & { accessory: 'chevron' };
type AccountRowValueProps = AccountRowBaseProps & {
  accessory: 'value';
  value: string;
};
type AccountRowSwitchProps = AccountRowBaseProps & {
  accessory: 'switch';
  checked: boolean;
  switchDisabled?: boolean;
  onValueChange: NonNullable<NativeSwitchProps['onValueChange']>;
  accessibilityHint?: string;
};
type AccountRowNoneProps = AccountRowBaseProps & { accessory: 'none' };

export type AccountRowProps =
  | AccountRowChevronProps
  | AccountRowValueProps
  | AccountRowSwitchProps
  | AccountRowNoneProps;

export function AccountRow(props: AccountRowProps) {
  const presentation = resolveAccountRowPresentation({
    label: props.label,
    sub: props.sub,
    accessory: props.accessory,
    value: props.accessory === 'value' ? props.value : undefined,
    disabled: props.disabled,
    last: props.last,
    family: props.family,
  });
  if (presentation === null) return null;

  const content = (
    <>
      <View style={presentation.iconSlotStyle} accessible={false}>
        <CorsoIcon
          name={props.glyph}
          size={presentation.iconSize}
          color={presentation.iconColor}
        />
      </View>
      <View style={presentation.textColumnStyle} accessible={false}>
        <CorsoText
          style={presentation.labelStyle}
          numberOfLines={presentation.labelNumberOfLines}
        >
          {presentation.labelText}
        </CorsoText>
        {presentation.subText ? (
          <CorsoText
            style={presentation.subStyle}
            numberOfLines={presentation.subNumberOfLines}
          >
            {presentation.subText}
          </CorsoText>
        ) : null}
      </View>
      {presentation.showValue ||
      presentation.showChevron ||
      presentation.showSwitchSlot ? (
        <View style={presentation.accessorySlotStyle} accessible={false}>
          {presentation.showValue ? (
            <CorsoText
              style={presentation.valueStyle}
              numberOfLines={presentation.valueNumberOfLines}
            >
              {presentation.valueText}
            </CorsoText>
          ) : null}
          {presentation.showChevron ? (
            <CorsoIcon
              name={presentation.chevronGlyph}
              size={presentation.chevronSize}
              color={presentation.chevronColor}
            />
          ) : null}
          {presentation.showSwitchSlot && props.accessory === 'switch' ? (
            <Switch
              checked={props.checked}
              disabled={props.switchDisabled ?? false}
              onValueChange={props.onValueChange}
              accessibilityLabel={
                props.accessibilityLabel ?? presentation.accessibilityLabel
              }
              accessibilityHint={props.accessibilityHint}
            />
          ) : null}
        </View>
      ) : null}
      {presentation.dividerStyle ? (
        <View style={presentation.dividerStyle} accessible={false} />
      ) : null}
    </>
  );

  if (props.onPress) {
    return (
      <Pressable
        testID={props.testID}
        style={presentation.containerStyle}
        onPress={props.onPress}
        disabled={presentation.disabled}
        accessibilityRole="button"
        accessibilityLabel={
          props.accessibilityLabel ?? presentation.accessibilityLabel
        }
        accessibilityState={{ disabled: presentation.disabled }}
      >
        {content}
      </Pressable>
    );
  }

  const hostsSwitch = presentation.showSwitchSlot;
  return (
    <View
      testID={props.testID}
      style={presentation.containerStyle}
      accessible={!hostsSwitch}
      accessibilityLabel={
        hostsSwitch
          ? undefined
          : (props.accessibilityLabel ?? presentation.accessibilityLabel)
      }
    >
      {content}
    </View>
  );
}

export type { AccountRowAccessory };

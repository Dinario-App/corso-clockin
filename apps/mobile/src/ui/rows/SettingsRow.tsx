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
  resolveSettingsRowPresentation,
  type SettingsRowAccessory,
  type SettingsRowFamily,
  type SettingsRowTone,
} from '@/src/ui/rows/settingsRowPresentation.js';

type SettingsRowBaseProps = {
  label: string;
  glyph?: CorsoIconName;
  sub?: string;
  tone?: SettingsRowTone;
  disabled?: boolean;
  /** Last row in a pane — drops its inset divider. */
  last?: boolean;
  onPress?: PressableProps['onPress'];
  accessibilityRole?: PressableProps['accessibilityRole'];
  accessibilityLabel?: string;
  testID?: string;
  /** `'desk'` on a tray on the desk ground — see `SettingsRowFamily`. */
  family?: SettingsRowFamily;
};

type SettingsRowChevronProps = SettingsRowBaseProps & {
  accessory: 'chevron';
};

type SettingsRowValueProps = SettingsRowBaseProps & {
  accessory: 'value';
  value: string;
};

type SettingsRowSwitchProps = SettingsRowBaseProps & {
  accessory: 'switch';
  checked: boolean;
  switchDisabled?: boolean;
  onValueChange: NonNullable<NativeSwitchProps['onValueChange']>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

type SettingsRowNoneProps = SettingsRowBaseProps & {
  accessory: 'none';
};

/** The selected option in a one-of list. */
type SettingsRowCheckProps = SettingsRowBaseProps & {
  accessory: 'check';
};

export type SettingsRowProps =
  | SettingsRowChevronProps
  | SettingsRowValueProps
  | SettingsRowSwitchProps
  | SettingsRowNoneProps
  | SettingsRowCheckProps;

export function SettingsRow(props: SettingsRowProps) {
  const presentation = resolveSettingsRowPresentation({
    label: props.label,
    accessory: props.accessory,
    glyph: props.glyph,
    sub: props.sub,
    tone: props.tone,
    disabled: props.disabled,
    last: props.last,
    value: props.accessory === 'value' ? props.value : undefined,
    family: props.family,
  });

  if (presentation === null) {
    return null;
  }

  const content = (
    <>
      {presentation.showIcon && props.glyph ? (
        <View style={presentation.iconSlotStyle} accessible={false}>
          <CorsoIcon
            name={props.glyph}
            size={presentation.iconSize}
            color={presentation.iconColor}
          />
        </View>
      ) : null}
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
      presentation.showSwitchSlot ||
      presentation.showCheck ? (
        <View style={presentation.accessorySlotStyle} accessible={false}>
          {presentation.showValue ? (
            <CorsoText style={presentation.valueStyle} numberOfLines={1}>
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
          {presentation.showCheck ? (
            <CorsoIcon
              name={presentation.checkGlyph}
              size={presentation.checkSize}
              color={presentation.checkColor}
            />
          ) : null}
          {presentation.showSwitchSlot && props.accessory === 'switch' ? (
            <Switch
              checked={props.checked}
              disabled={props.switchDisabled ?? false}
              onValueChange={props.onValueChange}
              accessibilityLabel={props.accessibilityLabel}
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
        accessibilityRole={props.accessibilityRole ?? 'button'}
        accessibilityLabel={
          props.accessibilityLabel ?? presentation.accessibilityLabel
        }
        accessibilityState={{
          disabled: presentation.disabled,
          ...presentation.accessibilityState,
        }}
      >
        {content}
      </Pressable>
    );
  }

  const hostsSwitchAccessory =
    presentation.showSwitchSlot && props.accessory === 'switch';

  return (
    <View
      testID={props.testID}
      style={presentation.containerStyle}
      accessible={!hostsSwitchAccessory}
      accessibilityState={presentation.accessibilityState}
      accessibilityLabel={
        hostsSwitchAccessory
          ? undefined
          : (props.accessibilityLabel ?? presentation.accessibilityLabel)
      }
    >
      {content}
    </View>
  );
}

export type { SettingsRowAccessory, SettingsRowTone };

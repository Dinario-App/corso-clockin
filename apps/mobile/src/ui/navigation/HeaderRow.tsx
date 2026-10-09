import { View, type PressableProps } from 'react-native';
import { CorsoBrandLockup } from '@/src/ui/brand/CorsoBrandLockup.js';
import { IconCircleButton } from '@/src/ui/controls/IconCircleButton.js';
import { ScreenHeader } from '@/src/ui/navigation/ScreenHeader.js';
import {
  resolveHeaderRowPresentation,
  type HeaderRowIconAction,
  type HeaderRowLeft,
  type HeaderRowRight,
} from '@/src/ui/navigation/headerRowPresentation.js';

type HeaderRowBaseProps = {
  title?: string;
  testID?: string;
};

type HeaderRowLeftBrand = HeaderRowBaseProps & {
  left: 'brand-lockup';
};

type HeaderRowLeftBack = HeaderRowBaseProps & {
  left: 'back-chevron';
  onBackPress: NonNullable<PressableProps['onPress']>;
  backAccessibilityLabel: string;
  backDisabled?: boolean;
};

type HeaderRowLeftNone = HeaderRowBaseProps & {
  left: 'none';
};

type HeaderRowRightNone = {
  right: 'none';
};

type HeaderRowRightOne = {
  right: 'one-icon';
  actions: [HeaderRowIconAction];
};

type HeaderRowRightTwo = {
  right: 'two-icons';
  actions: [HeaderRowIconAction, HeaderRowIconAction];
};

export type HeaderRowProps = (
  | HeaderRowLeftBrand
  | HeaderRowLeftBack
  | HeaderRowLeftNone
) &
  (HeaderRowRightNone | HeaderRowRightOne | HeaderRowRightTwo);

export function HeaderRow(props: HeaderRowProps) {
  const presentation = resolveHeaderRowPresentation({
    left: props.left,
    right: props.right,
    title: props.title,
    backAccessibilityLabel:
      props.left === 'back-chevron' ? props.backAccessibilityLabel : undefined,
    actions: 'actions' in props ? props.actions : undefined,
  });

  if (presentation === null) {
    return null;
  }

  return (
    <ScreenHeader
      testID={props.testID}
      title={presentation.titleVisible ? presentation.displayTitle : undefined}
      left={
        presentation.left === 'brand-lockup' ? <CorsoBrandLockup /> : undefined
      }
      onBack={props.left === 'back-chevron' ? props.onBackPress : undefined}
      backAccessibilityLabel={presentation.backAccessibilityLabel ?? undefined}
      backDisabled={props.left === 'back-chevron' && props.backDisabled === true}
      right={
        presentation.actions.length > 0 ? (
          <View style={presentation.rightIconsRowStyle}>
            {presentation.actions.map((action, index) => (
              <IconCircleButton
                key={`${action.glyph}-${index}`}
                glyph={action.glyph}
                onPress={action.onPress}
                accessibilityLabel={action.accessibilityLabel}
                fill={action.fill}
                badge={action.badge}
                testID={action.testID}
              />
            ))}
          </View>
        ) : undefined
      }
    />
  );
}

export type { HeaderRowLeft, HeaderRowRight, HeaderRowIconAction };

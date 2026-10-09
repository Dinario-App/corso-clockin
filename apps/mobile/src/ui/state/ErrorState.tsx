import {
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { SecondaryCTA } from '@/src/ui/controls/SecondaryCTA.js';
import { TextButton } from '@/src/ui/controls/TextButton.js';
import {
  resolveErrorStatePresentation,
  type ErrorStateCtaKind,
  type ErrorStateCtaStyleOverride,
  type ErrorStatePresentationInput,
} from '@/src/ui/state/errorStatePresentation.js';

type ErrorStateBaseProps = {
  title: string;
  body: string;
  testID?: string;
};

export type ErrorStateWithRetryProps = ErrorStateBaseProps & {
  retry: 'withRetry';
  ctaLabel: string;
  cta: ErrorStateCtaKind;
  onPress: NonNullable<PressableProps['onPress']>;
};

export type ErrorStateWithoutRetryProps = ErrorStateBaseProps & {
  retry: 'withoutRetry';
};

export type ErrorStateProps =
  | ErrorStateWithRetryProps
  | ErrorStateWithoutRetryProps;

function renderCta(
  kind: ErrorStateCtaKind,
  label: string,
  onPress: NonNullable<PressableProps['onPress']>,
  styleOverride: ErrorStateCtaStyleOverride,
) {
  const style = styleOverride as ViewStyle;
  switch (kind) {
    case 'secondary':
      return <SecondaryCTA label={label} onPress={onPress} style={style} />;
    case 'text':
      return <TextButton label={label} onPress={onPress} style={style} />;
  }
}

export function ErrorState(props: ErrorStateProps) {
  const presentation = resolveErrorStatePresentation(
    props.retry === 'withRetry'
      ? {
          retry: props.retry,
          title: props.title,
          body: props.body,
          ctaLabel: props.ctaLabel,
          cta: props.cta,
        }
      : (props as unknown as ErrorStatePresentationInput),
  );

  if (presentation === null) {
    return null;
  }

  if (presentation.retry === 'withRetry') {
    return (
      <View testID={props.testID} style={presentation.containerStyle}>
        <Text
          accessibilityRole="header"
          style={presentation.titleStyle}
        >
          {presentation.displayTitle}
        </Text>
        <View style={{ height: presentation.titleBodyGap }} />
        <Text
          accessibilityLabel={presentation.bodyAccessibilityLabel}
          style={presentation.bodyStyle}
          numberOfLines={presentation.bodyLayout.numberOfLines}
          ellipsizeMode={presentation.bodyLayout.ellipsizeMode}
        >
          {presentation.displayBody}
        </Text>
        <View style={{ height: presentation.bodyCtaGap }} />
        {renderCta(
          presentation.ctaKind,
          presentation.ctaLabel,
          (props as ErrorStateWithRetryProps).onPress,
          presentation.ctaStyleOverride,
        )}
      </View>
    );
  }

  return (
    <View testID={props.testID} style={presentation.containerStyle}>
      <Text
        accessibilityRole="header"
        style={presentation.titleStyle}
      >
        {presentation.displayTitle}
      </Text>
      <View style={{ height: presentation.titleBodyGap }} />
      <Text
        accessibilityLabel={presentation.bodyAccessibilityLabel}
        style={presentation.bodyStyle}
        numberOfLines={presentation.bodyLayout.numberOfLines}
        ellipsizeMode={presentation.bodyLayout.ellipsizeMode}
      >
        {presentation.displayBody}
      </Text>
    </View>
  );
}

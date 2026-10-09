import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { ethena } from '@/constants/theme.ethena';
import { ETHENA_BODY_MARGIN, ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { CorsoText } from '@/src/theme/CorsoText';
import { EthenaNav } from '@/src/ui/ethena/EthenaChrome';
import { EthenaTray } from '@/src/ui/ethena/EthenaPrimitives';

/** Presentation only. The caller owns back/step-up/signing policy. */
export function SendScreenHeader({
  title,
  onBack,
  backDisabled = false,
  backAccessibilityLabel = 'Back',
  testID,
}: {
  title: string;
  onBack: () => void;
  backDisabled?: boolean;
  backAccessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <View testID={testID}>
      <EthenaNav
        left={
          <Pressable
            style={{
              minWidth: 44,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={onBack}
            disabled={backDisabled}
            accessibilityRole="button"
            accessibilityLabel={backAccessibilityLabel}
            accessibilityState={{ disabled: backDisabled }}
          >
            <CorsoText
              style={{ ...ETHENA_TYPE.back, color: ethena.ink.primary }}
            >
              ‹
            </CorsoText>
          </Pressable>
        }
      />
      <CorsoText
        accessibilityRole="header"
        style={{
          ...ETHENA_TYPE.title,
          color: ethena.ink.primary,
          marginHorizontal: ETHENA_BODY_MARGIN,
          marginBottom: 12,
        }}
      >
        {title}
      </CorsoText>
    </View>
  );
}

/** Same children and padding as Send's former card; Ethena ground material. */
export function SendScreenCard({
  contentStyle,
  children,
}: {
  contentStyle?: ViewStyle;
  children?: ReactNode;
}) {
  return (
    <EthenaTray testID="send-tray" style={contentStyle}>
      {children}
    </EthenaTray>
  );
}

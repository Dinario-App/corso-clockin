import { useEffect, useRef, useState } from 'react';
import { Pressable, View, type TextStyle } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { CorsoText } from '@/src/theme/CorsoText';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { ethena } from '@/constants/theme.ethena';
import {
  PROFILE_COPY_FLASH_MS,
  ProfileRootPane,
  profileRootType,
} from './ProfileRootEthena';
import { ACCOUNT_IDENTITY_CARD_STYLE } from './profileRootPaint';

export type AccountIdentityCardProps = {
  /** The account's display name. No name service is resolved anywhere in the app. */
  name: string;
  /** Display data already masked by the session identity projection. */
  maskedEmail?: string | null;
  /** The full address, copied verbatim. `null` draws the card with no address row. */
  address: string | null;
  /** The ellipsized form the card prints (`7xKq…9fWd`). */
  addressShort: string | null;
  copyAccessibilityLabel: string;
  copiedLabel: string;
  copyFailedLabel: string;
  testID?: string;
};

export function AccountIdentityCard({
  name,
  maskedEmail,
  address,
  addressShort,
  copyAccessibilityLabel,
  copiedLabel,
  copyFailedLabel,
  testID,
}: AccountIdentityCardProps) {
  const [flash, setFlash] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function showFlash(message: string) {
    if (timer.current) clearTimeout(timer.current);
    setFlash(message);
    timer.current = setTimeout(() => setFlash(null), PROFILE_COPY_FLASH_MS);
  }

  async function onCopy() {
    if (!address) return;
    try {
      await Clipboard.setStringAsync(address);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFlash(copiedLabel);
    } catch {
      showFlash(copyFailedLabel);
    }
  }

  return (
    <ProfileRootPane testID={testID ?? 'account-identity-card'} style={CARD}>
      <CorsoText style={profileRootType.identityName} numberOfLines={1}>
        {name}
      </CorsoText>
      {maskedEmail ? (
        <CorsoText style={profileRootType.address} numberOfLines={1}>
          {maskedEmail}
        </CorsoText>
      ) : null}
      {addressShort && address ? (
        <Pressable
          onPress={() => {
            void onCopy();
          }}
          accessibilityRole="button"
          accessibilityLabel={copyAccessibilityLabel}
          style={ADDRESS_BUTTON}
          testID={testID ? `${testID}-copy` : undefined}
        >
          {flash === null ? (
            <>
              <CorsoText
                style={[profileRootType.address, MONO]}
                numberOfLines={1}
              >
                {addressShort}
              </CorsoText>
              <CorsoIcon name="copy" size={11} color={ethena.ink3} />
            </>
          ) : (
            <CorsoText style={profileRootType.addressCopied} numberOfLines={1}>
              {flash}
            </CorsoText>
          )}
        </Pressable>
      ) : null}
    </ProfileRootPane>
  );
}

const MONO: TextStyle = {
  /**
   * The house cast (`src/theme/CorsoText.tsx`): React Native's `FontVariant`
   * union omits `slashed-zero` even though the runtime honours it.
   */
  fontVariant: ['tabular-nums', 'slashed-zero'] as TextStyle['fontVariant'],
};

const CARD = ACCOUNT_IDENTITY_CARD_STYLE;

const ADDRESS_BUTTON = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  paddingVertical: 2,
  alignSelf: 'flex-start',
} as const;

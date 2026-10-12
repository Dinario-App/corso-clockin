import { View } from 'react-native';
import { ethena } from '@/constants/theme.ethena';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { CorsoText } from '@/src/theme/CorsoText';
import { ProfileRootPane } from './ProfileRootEthena';

export type ProfileIdentityCardProps = {
  /** "Main account". */
  title: string;
  /** The saved portfolio name. `null` while it is still being read. */
  name: string | null;
  maskedEmail: string | null;
  /** Two initials from the name; `null` draws an empty disc. */
  initials: string | null;
  /** "Portfolio". */
  eyebrow: string;
  /** The balance head's headline (a read total or the named placeholder). */
  total: string;
  accessibilityLabel: string;
  testID?: string;
};

const DISC = 44;

export function ProfileIdentityCard({
  title,
  name,
  maskedEmail,
  initials,
  eyebrow,
  total,
  accessibilityLabel,
  testID,
}: ProfileIdentityCardProps) {
  return (
    <ProfileRootPane testID={testID ?? 'profile-identity'}>
      <View
        accessible
        accessibilityLabel={[title, name, accessibilityLabel]
          .filter(Boolean)
          .join(', ')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
        }}
      >
        <View
          style={{
            width: DISC,
            height: DISC,
            borderRadius: DISC / 2,
            backgroundColor: ethena.crest,
            borderWidth: 1,
            borderColor: ethena.hair,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {initials ? (
            <CorsoText
              style={{
                ...ETHENA_TYPE.keyValueTotal,
                color: ethena.ink.primary,
              }}
              maxFontSizeMultiplier={1.3}
            >
              {initials}
            </CorsoText>
          ) : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <CorsoText
            style={{ ...ETHENA_TYPE.keyValueTotal, color: ethena.ink.primary }}
            numberOfLines={1}
          >
            {title}
          </CorsoText>
          <CorsoText
            style={{ ...ETHENA_TYPE.rowSub, color: ethena.mute }}
            numberOfLines={1}
          >
            {name ?? ' '}
          </CorsoText>
          {maskedEmail ? (
            <CorsoText
              style={{ ...ETHENA_TYPE.rowSub, color: ethena.mute }}
              numberOfLines={1}
            >
              {maskedEmail}
            </CorsoText>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
          <CorsoText
            style={{
              ...ETHENA_TYPE.keyValueInfo,
              // Mute, not the frame's ink/3: on the lit tray near the top
              // ink/3 reads 4.1:1 (`deskGroundQuietInk.test.ts`).
              color: ethena.mute,
            }}
          >
            {eyebrow}
          </CorsoText>
          <CorsoText
            style={{
              ...ETHENA_TYPE.keyValueTotal,
              color: ethena.ink.primary,
              fontVariant: ['tabular-nums'],
            }}
            numberOfLines={1}
            testID="profile-identity-total"
          >
            {total}
          </CorsoText>
        </View>
      </View>
    </ProfileRootPane>
  );
}

import { Pressable } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import {
  PROFILE_DANGER_GAP,
  PROFILE_DANGER_GLYPH,
  PROFILE_DOWN,
  ProfileRootPane,
  profileRootType,
} from './ProfileRootEthena';

export type AccountDangerZoneProps = {
  label: string;
  note: string;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
};

export function AccountDangerZone({
  label,
  note,
  onPress,
  accessibilityLabel = label,
  testID,
}: AccountDangerZoneProps) {
  return (
    <>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={{ marginTop: PROFILE_DANGER_GAP }}
        testID={testID}
      >
        <ProfileRootPane testID="account-danger-pane" style={STYLES.pane}>
          <CorsoIcon
            name="warning"
            size={PROFILE_DANGER_GLYPH}
            color={PROFILE_DOWN}
          />
          <CorsoText style={profileRootType.dangerLabel}>{label}</CorsoText>
        </ProfileRootPane>
      </Pressable>
      <CorsoText style={[profileRootType.dangerNote, STYLES.note]}>{note}</CorsoText>
    </>
  );
}

const STYLES = {
  pane: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 66,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  note: { marginTop: 12 },
} as const;

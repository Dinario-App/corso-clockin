import { Alert, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { copy } from '@/constants/copy';
import { PUSH_COPY } from './pushRegistration';
export const PRICE_ALERT_CHANNEL = 'price-alerts';
export function askForAlertPush(): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      '',
      PUSH_COPY.ask,
      [
        {
          text: PUSH_COPY.later,
          onPress: () => resolve(false),
          style: 'cancel',
        },
        { text: PUSH_COPY.on, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
export async function hasAlertPushPermission() {
  return (await Notifications.getPermissionsAsync()).granted;
}
export async function allowAlertPush() {
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync(PRICE_ALERT_CHANNEL, {
      name: copy.profile.notificationsTitle,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted
    ? current
    : current.canAskAgain
      ? await Notifications.requestPermissionsAsync()
      : current;
  if (permission.granted) return true;
  Alert.alert('', PUSH_COPY.off, [
    { text: PUSH_COPY.later, style: 'cancel' },
    {
      text: PUSH_COPY.settings,
      onPress: () => {
        void Linking.openSettings().catch(() => {});
      },
    },
  ]);
  return false;
}
export async function readAlertPushToken() {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (typeof projectId !== 'string' || !projectId)
    throw Error('push_project_unavailable');
  // The SDK default persists automatic token registration and later reads a
  // token on import. An explicit endpoint opts out of that SDK behavior.
  await Notifications.setAutoServerRegistrationEnabledAsync(false);
  try {
    return (
      await Notifications.getExpoPushTokenAsync({
        projectId,
        url: 'https://exp.host/--/api/v2/push/getExpoPushToken',
      })
    ).data;
  } catch {
    throw Error('push_token_unavailable');
  }
}

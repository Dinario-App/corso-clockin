import { Platform } from 'react-native';
import { mwaTransact } from './mwaTransport';
import { MwaError, type MwaTransact } from './mwaTypes';
/** Metro selects the native adapter; Play and other platforms refuse even persisted sessions. */
export const mwaRuntimeTransact: MwaTransact = async run => {
  if (Platform.OS !== 'android') throw new MwaError('platform_unsupported');
  const { default: Constants } = await import('expo-constants');
  if (Constants.expoConfig?.extra?.flavor !== 'seeker') throw new MwaError('platform_unsupported');
  return mwaTransact(run);
};

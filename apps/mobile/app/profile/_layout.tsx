import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';

/**
 * One nested route boundary for every current and future `/profile/*` screen.
 * The root navigator registers this boundary once inside its session guard.
 */
export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    />
  );
}

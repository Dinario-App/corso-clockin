export const WELCOME_EMAIL_EXIT = {
  pathname: '/(auth)/signin',
  params: { method: 'email' },
} as const;

export const WELCOME_GOOGLE_EXIT = {
  pathname: '/(auth)/signin',
  params: { method: 'google' },
} as const;

export const WELCOME_APPLE_EXIT = {
  pathname: '/(auth)/signin',
  params: { method: 'apple' },
} as const;

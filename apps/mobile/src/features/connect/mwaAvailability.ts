export type MwaAvailabilityInput = Readonly<{
  connectEnabled: unknown;
  platformOS: string;
  flavor: unknown;
  identityConfigured: unknown;
}>;

export function resolveMwaAvailability(input: MwaAvailabilityInput): boolean {
  return (
    input.connectEnabled === true &&
    input.platformOS === 'android' &&
    input.flavor === 'seeker' &&
    input.identityConfigured === true
  );
}

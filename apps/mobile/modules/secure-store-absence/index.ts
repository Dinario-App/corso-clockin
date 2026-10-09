import { requireOptionalNativeModule } from 'expo';

/** What the Android module reports: whether ANY SecureStore location for the keys still holds an entry on disk. */
export type SecureStoreAbsenceObservation = Readonly<{
  seen: string;
  why: string;
}>;

export type SecureStoreAbsenceNativeModule = Readonly<{
  observe(
    keys: readonly string[],
    keychainService: string,
  ): Promise<SecureStoreAbsenceObservation>;
}>;

export const SecureStoreAbsenceNative =
  requireOptionalNativeModule<SecureStoreAbsenceNativeModule>(
    'CorsoSecureStoreAbsence',
  );

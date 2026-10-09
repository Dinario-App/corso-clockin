/**
 * Resolve Address Lookup Tables so swap semantic checks can see full account keys.
 * Meta/Ultra routes commonly use ALTs — without this, getAccountKeys() throws.
 */
import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  VersionedTransaction,
  type AccountKeysFromLookups,
} from '@solana/web3.js';

export async function resolveAddressLookupTables(
  transaction: VersionedTransaction,
  connection: Connection,
): Promise<AddressLookupTableAccount[]> {
  const lookups = transaction.message.addressTableLookups;
  if (lookups.length === 0) return [];

  const tables: AddressLookupTableAccount[] = [];
  for (const lookup of lookups) {
    const result = await connection.getAddressLookupTable(lookup.accountKey);
    if (!result.value) {
      throw new Error(
        'Swap quote uses an unresolved address table. Get a fresh quote.',
      );
    }
    tables.push(result.value);
  }
  return tables;
}

/** Shape required by MessageV0.getAccountKeys in @solana/web3.js. */
export function toAccountKeysFromLookups(
  transaction: VersionedTransaction,
  tables: AddressLookupTableAccount[],
): AccountKeysFromLookups {
  const writable: PublicKey[] = [];
  const readonly: PublicKey[] = [];

  for (const lookup of transaction.message.addressTableLookups) {
    const table = tables.find((item) => item.key.equals(lookup.accountKey));
    if (!table) {
      throw new Error(
        'Swap quote uses an unresolved address table. Get a fresh quote.',
      );
    }
    for (const index of lookup.writableIndexes) {
      const key = table.state.addresses[index];
      if (!key) {
        throw new Error('Swap address table index is out of range.');
      }
      writable.push(key);
    }
    for (const index of lookup.readonlyIndexes) {
      const key = table.state.addresses[index];
      if (!key) {
        throw new Error('Swap address table index is out of range.');
      }
      readonly.push(key);
    }
  }

  return { writable, readonly };
}

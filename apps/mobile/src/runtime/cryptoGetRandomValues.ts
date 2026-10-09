export type RandomValuesArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | BigInt64Array
  | BigUint64Array;

export type GetRandomValues = <T extends RandomValuesArray>(array: T) => T;

type CryptoTarget = {
  crypto?: {
    getRandomValues?: GetRandomValues;
  };
};

export function installCryptoGetRandomValues(
  target: CryptoTarget,
  fill: GetRandomValues,
): void {
  if (!target.crypto) {
    Object.defineProperty(target, 'crypto', {
      value: {},
      configurable: true,
      enumerable: false,
      writable: true,
    });
  }

  const crypto = target.crypto;
  if (!crypto) throw new Error('Crypto installation failed.');

  const secureGetRandomValues: GetRandomValues = (array) => {
    fill(array);
    return array;
  };

  Object.defineProperty(crypto, 'getRandomValues', {
    value: secureGetRandomValues,
    configurable: true,
    writable: true,
  });
}

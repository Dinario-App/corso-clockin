import 'react-native';
import 'text-encoding';
import { Buffer } from 'buffer';
import '@ethersproject/shims';
import * as ExpoCrypto from 'expo-crypto';
import { installCryptoGetRandomValues } from './src/runtime/cryptoGetRandomValues';

// eslint-disable-next-line no-undef
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}

installCryptoGetRandomValues(globalThis, ExpoCrypto.getRandomValues);

import './src/features/security/initMobileSentry.bootstrap';

import 'expo-router/entry';

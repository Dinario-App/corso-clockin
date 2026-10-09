# `@corso/wallet`

Local-only wallet primitives for Corso. This package does not import `fetch`, HTTP clients, RPC clients, or any other network transport.

## Public exports

- `importMnemonicToAddress(mnemonic)` validates an English BIP39 phrase and derives the Solana account at `m/44'/501'/0'/0'`.
- `createImportedMnemonicStore(secureStore)` wraps the Expo SecureStore-shaped methods `getItemAsync`, `setItemAsync`, and `deleteItemAsync`. Mnemonic operations require device authentication.
- `createImportedSeedSigner(store)` restores an `imported_seed` signer, exposes its address and `CorsoSigner` capabilities, and supports local `signMessage`.
- `CorsoSigner`, `ImportedSeedSigner`, `SignerCapabilities`, and `SessionType` describe the signer contract without importing a mobile SDK.

Call `clear()` whenever the app locks or the imported session is released so the in-memory secret is zeroized.

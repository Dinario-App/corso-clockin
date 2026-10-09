# Corso: CLOCK IN snapshot

Corso is a trading desk for everyday traders on Solana. You can see your holdings, look up a token before you swap it, swap, and set price alerts. Corso runs on Android, including the Solana Seeker.

This repository is a single-commit snapshot of the Corso Android app and the shared packages it uses, cut for CLOCK IN judging from the same source commit as the submitted APK.

Compared with that commit, the app's code is unchanged apart from comments and whitespace, with the exceptions listed under "Differences from the submitted build" below. Tests, test fixtures and internal tooling are not included, because they are not needed to build or run the app. Three files whose names still say "fixture" are bundled display data that the app uses at runtime, not test fixtures: `apps/mobile/src/features/desk/backpack-collateral.fixture.json` (desk screen), `apps/mobile/src/features/tokens/tokenIconFixture.json` (token icons) and `apps/mobile/src/features/howItWorks/howItWorksFixtures.ts` (the How it works screens).

Corso is developed in a private monorepo. On request, we can walk the organizer through the full commit history to verify it.

## Where to look

| Path | What it is |
|---|---|
| `apps/mobile/` | The Expo / React Native app |
| `apps/mobile/src/features/connect/` | Mobile Wallet Adapter (MWA): connecting an external Solana wallet |
| `apps/mobile/src/features/aiConnect/` | Shared types, the off switch and small helpers for an optional "connect your own AI model" feature. The feature is switched off in this build (`flags.ts` always returns off), so no model sign-in or provider calls are in the app. The folder also holds the server-sent-events parser the live price stream uses. |
| `apps/mobile/src/ui/ethena/`, `apps/mobile/constants/theme.ethena.ts` | The app's visual system. "Ethena" is only an internal code name; it is not the Ethena protocol. |
| `apps/mobile/app/(auth)/returning.tsx` | A one-time note for a phone that still has data from the company's earlier Dinario app. |
| `packages/wallet/` | `@corso/wallet` (on-device seed import helpers, with no networking) |
| `packages/swap-config/` | `@corso/swap-config` (swap fee configuration by token pair) |
| `packages/price-format/` | `@corso/price-format` (USD formatting for price alerts) |
| `packages/disclosures/` | `@corso/disclosures` (disclosure IDs shared by app and API) |
| `packages/why/` | `@corso/why` (reason codes the app turns into its own copy) |

The backend API isn't part of this snapshot. The app's copy and refusal tables for the Ask feature, which normally live with the API, are included at `apps/mobile/src/features/ask/server-copy/` so the app builds on its own. They are the API's files with only their comments removed. `src/features/ask/askText.ts` and `src/features/ask/askAnswerBoundary.ts` import them from that folder instead of from the API.

## Differences from the submitted build

- The Ask copy and refusal tables are copied in, and two import paths point at them (described above).
- A development-only preview screen (`app/dev/`) and the sample data it used are removed. In a release build that screen only showed a "development build only" message.
- The provider sign-in and model-client code of the switched-off AI connect feature is removed. None of it was in the submitted app bundle; the few types other files still use are now in `aiConnect/types.ts`.
- Two unused exported values (a table of design notes and a duplicate privacy-policy helper) are removed, and three internal descriptions in `src/features/session/localClearRegistry.ts` are reworded. The app never reads or shows them.

## Build the APK

Requirements: Node 20 or later, pnpm 9.15, JDK 17, and the Android SDK (with `ANDROID_HOME` set).

```sh
export CORSO_FLAVOR=seeker CORSO_SEEKER_TRACK=production APP_ENV=production
pnpm install --frozen-lockfile
cd apps/mobile
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease -Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=1g"
# output: apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

`expo-dev-client` is listed in `app.json` so the project can also make a development build; `assembleRelease` produces the release APK.

A local build gets Expo's default Android version code (1), because `app.json` does not set `android.versionCode`, and it is signed with your local key, so its version code and signature differ from the submitted APK. With the variables above, the package name (`com.dinario.app`) and the app code are the same. Crash reporting is off in a local build.

## Package ID

The Android package ID is `com.dinario.app` (company legal name), app name Corso.

`app.json` lists `app.corso.wallet`. `apps/mobile/app.config.ts` replaces the Android package with `com.dinario.app` when `CORSO_FLAVOR=seeker` and `CORSO_SEEKER_TRACK=production`, which the build commands above set. Any other Seeker track uses `com.dinario.app.preview`.

## Brand assets

The app icon and splash images are in `apps/mobile/assets/brand/pari/` and `apps/mobile/assets/brand/pari-chrome/` (Pari is the name of the current icon set). The icon shown in the wallet-connect prompt is the same artwork, served from `https://corso.trade`.

## Third-party code

`apps/mobile/vendor/vela/` is the published `@luxalgo/vela` npm package (0.6.17), Apache-2.0, with two local modifications listed in `MANIFEST.json`. Its LICENSE and NOTICE files are kept in that folder, and the chart's built-in Vela attribution mark is left on.

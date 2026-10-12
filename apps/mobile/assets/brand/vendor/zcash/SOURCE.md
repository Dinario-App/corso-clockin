# Zcash ZEC mark — vendored, fill moved inline

Source: the `icon` in the token-icon fixture
(`src/features/tokens/tokenIconFixture.json`) for the ZEC mint
`A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS`, which is the mint's own
metadata image:
`https://arweave.net/QSYqnmB7NYlB7n1R6rz935Y07dlRK0tIuKe2mof5Sho`.

Fetched 2026-10-12 08:05 UTC (HTTP 302 to the arweave gateway, then HTTP 200,
`image/svg+xml`, 1400 bytes), sha256
`c202292c36336b109523fff68c5e8de3a659ca2dbea6a7d1e9fdead80c0e1a90`.
Arweave transaction ids are content-addressed, so these are the bytes the
issuer uploaded.

The one edit: the original paints its disc through a class,
`<style>.cls-1{fill:url(#linear-gradient);}</style>` and
`<path class="cls-1" …>`. react-native-svg's `SvgUri` ignores CSS classes, so
the path took the default black fill and the disc drew black.
`zec.svg` drops the `<style>` element and writes the same fill inline on that
path, `fill="url(#linear-gradient)"`. No other byte changed: same gradient,
stops (`#cf8724` → `#fdce58`), paths and viewBox.

- `zec.svg`: the inline-fill SVG, sha256
  `5814acc4fcb90ae7fe1b5bed706614842e39f3f852d49b7423171faa87d289d4`.
- `zec.png`: `rsvg-convert -w 640 -h 640 zec.svg`, 640 × 640 RGBA, 38339
  bytes, sha256
  `1a6520d9e3f2927c80a495f6413b533af87612047a284b2863070dbd56bcde59`.
  Rasterising the untouched original (librsvg honours the class) gives the
  same sha256, so the inline edit changes nothing a CSS-aware renderer draws.

The app ships the PNG through the same bundled `Image` path as cbBTC
(`assets/brand/vendor/coinbase/SOURCE.md`): the resolver
(`src/features/tokens/tokenIconResolve.ts`, `BUNDLED_TOKEN_ICONS`) maps the
mint to `bundled:zec` in the wealth build only. Flag off keeps the fixture url.
No recolour, no crop, no redraw.

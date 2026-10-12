# Coinbase cbBTC mark — vendored, unaltered

Source: the `icon` that Jupiter's token API returns for the cbBTC mint
`cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij`
(`GET https://lite-api.jup.ag/tokens/v2/search?query=cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij`),
which is the mint's own metadata image: IPFS CID
`QmZ7L8yd5j36oXXydUiYFiFsRHbi3EdgC4RuFwvM7dcqge`.

Fetched 2026-10-12 05:50 UTC through `https://gateway.pinata.cloud/ipfs/<cid>`
(HTTP 200, `image/png`, 22605 bytes). The CID is a content hash, so these are
the bytes the issuer pinned, whichever gateway served them.

File: `cbbtc.png`, 640 × 640 RGBA,
sha256 `d43e85e73b77180a873c36ebed62c56a0153dab872e7803e453acc8af686f1cf`.
No recolour, no crop, no redraw.

Why bundled: the fixture URL is `https://ipfs.io/ipfs/<cid>`, and
`ipfs.io` answers the app with HTTP 429 (re-checked 2026-10-12: 429, as is `dweb.link`). The failed load became the
`CB` monogram on every surface. The resolver
(`src/features/tokens/tokenIconResolve.ts`, `BUNDLED_TOKEN_ICONS`) now maps the
mint to this file, so no gateway is in the path.

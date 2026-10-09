# Google "G" — vendored, unaltered

Source: Google Identity Sign-In branding assets,
`https://developers.google.com/static/identity/images/signin-assets.zip`,
fetched 2026-09-30 02:42 UTC (HTTP 200, 855303 bytes).

File: `Android + Web/PNG @4x/Dark/Theme=Dark, Show text=No, Shape=Square, Platform=Android+Web@4x.png`
(sha256 `0da0f2b6250ddbde07200b1d49555111c314fe32bde94c9f7a306227650e50d5`, 160 × 160).

`google-g-dark@4x.png` is the 96 × 96 crop at (32, 32): the G's 20dp box plus
2dp of the button's own `#131314` ground on every side. No recolour, no redraw.
The @3x / @2x / @1x files are LANCZOS downscales of that crop. The button that
draws it (`src/ui/auth/ProviderSignInButtons.tsx`) uses Google's dark theme:
fill `#131314`, 1px stroke `#8E918F`, label `#E3E3E3`.

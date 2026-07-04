# identican

Zero-dependency TypeScript library: `identican(seed, { size? })` deterministically turns a seed string into a soda-can identicon as an SVG markup string. The logic is `src/index.ts`; the can artwork is the hand-drawn `soda-can.svg` in the repo root, baked into the generated `src/template.ts`. Design rationale lives in `docs/DESIGN.md`.

## Commands

- `npm run build` — `tsc --emitDeclarationOnly` for `.d.ts` + esbuild for minified ESM, into `dist/`
- `npm test` — builds, then `node --test` (tests in `test/` run against `dist/`)
- `npm run demo` — writes `index.html` (64-can grid) for visual review; open it in a browser after any visual change. Bundles the library from `src/` with esbuild, so it does not need a build first
- `npm run dev` — watches `src/` and rewrites `index.html` on every save (refresh the browser to see changes)
- `npm run format` — Prettier over the repo (also runs on save in VS Code via `.vscode/settings.json`)
- `node scripts/extract-template.mjs` — regenerates `src/template.ts` from `soda-can.svg`; run after editing the artwork, never edit `src/template.ts` by hand

## Invariants

- **Determinism**: same seed → byte-identical SVG, on every platform. All randomness comes from the seeded mulberry32 PRNG in `src/index.ts` — never `Math.random`.
- **Draw order is the format**: parameters are drawn from the PRNG in a fixed order. Reordering, adding, or removing a draw changes every existing identicon — treat that as a breaking change, don't do it casually.
- **Contrast by construction**: background and can are complementary (hues 180° apart); the pattern uses one of the can hue's triadic colors (±120°). The can must never blend into the background — keep that property when touching colors.
- No runtime dependencies. Keep it that way.

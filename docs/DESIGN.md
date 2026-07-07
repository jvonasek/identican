# Design

The settled design decisions behind `identican`, recorded so visual tuning doesn't re-litigate them.

## Output

A pure function returning an SVG markup string. No framework coupling; works via `innerHTML`, `data:` URI, or `dangerouslySetInnerHTML`. A React wrapper was considered and skipped — the string covers it.

## Determinism

```
seed string → FNV-1a 32-bit hash → mulberry32 PRNG → fixed sequence of draws
```

The draw order **is** the output format. In order: `baseHue` (1 of 20, 18° apart), can-hue offset (1 of 4: 150/165/195/210°), `patternType` (×16), pattern triadic side (±120°), pattern saturation, pattern lightness, then whatever geometry draws the chosen pattern makes. Any change to this sequence — reordering, adding, or removing a draw — changes every existing identicon and is a breaking change. `Math.imul`-based integer math keeps results identical across JS engines; `Math.random` is never used.

The PRNG's determinism is spec-guaranteed: `Math.imul` and `>>> 0` are exact integer operations, so the hash, the PRNG state, and every seeded choice (hue, pattern type, side, counts, offsets) are byte-identical on any conforming engine. Pattern geometry goes a step further and also calls `Math.sin`, `Math.cos`, `Math.sqrt`, and `Math.hypot`, whose results the ECMAScript spec explicitly allows to be implementation-approximated — engines aren't required to agree bit-for-bit. In practice they do: V8, JSC, and SpiderMonkey all ship fdlibm-derived implementations of these functions, and every emitted coordinate is rounded to one decimal place by `n()`, which absorbs the sub-ULP differences engines actually exhibit — a cross-engine byte diff would need a computed value landing within roughly 1e-12 of a .05 rounding boundary. So the verdict is: identical output across V8/JSC/SpiderMonkey holds in practice, but is spec-guaranteed only for colors and draw choices, not for pattern geometry. A hard guarantee there would mean switching to fixed-point trig, which was considered and rejected — the cost isn't worth it for a risk this small.

Def IDs (gradients, clipPath) are derived from the seed hash plus the theme options (`background`/`hue`/`saturation`/`lightness`), so multiple inlined identicons on one page don't collide — including the same seed rendered with different theme knobs, whose gradient defs differ. Same seed + same options share IDs, which is harmless because those defs are identical (`size` is excluded for the same reason: defs don't depend on it).

## Color model (procedural HSL)

Split-complementary + triadic. A curated palette was considered and rejected: procedural HSL gives unlimited distinct combos with the contrast rule enforced structurally.

- **Background**: diagonal gradient `hsl(baseHue, 72%, 74%)` → `hsl(baseHue+25, 80%, 55%)`, first stop at offset 0.3, `baseHue` is one of 20 discrete hues 18° apart (`Math.floor(rand()*20)*18`). The can and pattern hues derive from it (a seeded ≥150° offset and its ±120° triad) and sit off this grid — by design, for extra variety; only the background rides the clean wheel. The `background` option swaps it for a solid color (the gradient's first stop, so the two modes stay consistent) or none (transparent) — a render-time switch, no PRNG draws involved.
- **Can body**: `hsl(baseHue + offset, 60%, 52%)`, where `offset` is a seeded pick from `[150, 165, 195, 210]` — a soft split-complement, always ≥150° from the background so the can stands out by construction, with no palette to maintain.
- **Pattern**: can hue ±120° (a seeded coin flip picks the side), saturation 55–80%, lightness 50–60% — a clearly distinct hue that still forms a coherent triad with the can.

**Legibility guard**: hues 120° apart can still land on near-identical perceived brightness (green vs teal, orange vs olive). When the pattern's perceived brightness (`lum()`, rec. 709 weights on gamma-encoded RGB) is within 0.15 of the can's, the pattern lightness gets adjusted — a deterministic post-adjustment of already-drawn values, no extra PRNG draw. It kicks in on roughly a fifth of seeds. The comparison runs on the final post-knob colors (after the `hue`/`saturation`/`lightness` options are applied). The adjustment is direction-aware: a `+35 * min(1, lightness)` lift is tried first (matching the original behavior, and always the winner on dark/moody palettes), but on light palettes that lift can saturate against the 100% clamp without actually separating the colors — so if the lifted color still lands within 0.15 of the can's brightness, the guard instead falls back to whichever direction separates more — up or down, by the same scaled amount. This keeps the pattern legible even when the palette is pushed toward white.

**Theme knobs**: the `hue` option (default 0) adds a fixed rotation to every emitted hue; `saturation` and `lightness` (defaults 1) are global multipliers on every emitted color, clamped to 0–100%. All three funnel through one helper at render time, so consumers can theme the overall look (grayscale, pastel, moody, rotated) without touching the seeded values or the draw order.

## Geometry (template-based)

The can artwork is hand-drawn line art: `soda-can.svg` in the repo root (906×1524) is the single source of truth for the can's look. `scripts/extract-template.mjs` extracts its path into the generated `src/template.ts` (coords rounded to integers to shrink output) — rerun it after editing `soda-can.svg`, never edit `src/template.ts` by hand.

Rendering is paint-by-numbers under the line art, all in template coordinates:

- `viewBox="0 0 1524 1524"` — square, the can centered via `translate(309 0)` and shrunk about the canvas center by `CAN_SCALE` (0.9) for breathing room. The `size` option only sets the `width`/`height` attributes.
- Layers bottom-to-top: background → can silhouette + lid-ring ellipse filled with the can color (`SILHOUETTE_D` is an approximation kept just inside the template's outline; the shoulder flare is nearly straight in the artwork, so straight segments hug it) → silver lid + pull-tab underfill ellipses → pattern clipped to the label region → highlight gradient (dark edge → white sheen → transparent → dark edge, faking the cylinder) → the black template path on top, which covers all the seams.
- Label region `L` (x 126–774, y 372–1290): the whole main body of the can, flush with the template's drawn lines — shoulder line at the top, bottom outline at the bottom. Its top/bottom edges are ellipse arcs matching the template's rim curvature (rx 324, ry `EDGE_RY` = 55). `LABEL_D` doubles as the pattern clip and the highlight overlay.
- **Pattern warp**: patterns that wrap are drawn on the cylinder surface, not as a flat texture. `droop(x) = PATTERN_CURVE·√(1−((x−CX)/RX)²)` gives the vertical displacement of a surface point at horizontal position `x` (max `PATTERN_CURVE` = 72 at the center, 0 at the edges). `PATTERN_CURVE` is deliberately stronger than the rims' `EDGE_RY` so the wrap reads clearly; only the clip must match the template's drawn lines. Stripes and bands are exact elliptical-arc rings (`ring()`); pinstripes and the spiral apply `droop` per point. Some patterns are deliberately flat — see each type below.
- The can is always upright and centered. A seeded ±15° tilt existed initially and was removed; pseudo-3D rotation was likewise rejected as not worth faking in flat SVG.

## Patterns

Sixteen types, seed-picked, all clipped to the label region. A handful of simple types was chosen over two (too repetitive across a user list) and over many elaborate ones (each needs tuning against every color combo). Line-based types have fixed thickness and symbols a fixed size — seeds vary counts, offsets, and directions, never dimensions.

| #    | Type                                   | Geometry                                                                                                                                                                        | Seeded                                |
| ---- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 0    | Horizontal stripes                     | `ring()` bands, `STRIPE_SIZE` tall, fixed gap and offset                                                                                                                        | nothing                               |
| 1    | Pinstripes                             | 5 thin saw-toothed zigzag lines (`PIN_SIZE` stroke, `PIN_TOOTH` half-height, `PIN_GAP` peak-to-valley), evenly spaced, drooped per point                                        | count draw (currently collapses to 5) |
| 2    | Waves                                  | sine polylines (`WAVE_SIZE` stroke), fixed amplitude/wavelength/spacing, drawn flat                                                                                             | nothing                               |
| 3    | Polkadot                               | exactly 3 rows of large dots (`DOT_SIZE`), middle row offset half a column for a zigzag; edge dots clipped mid-shape                                                            | nothing                               |
| 4    | Bands                                  | 1 double-height or 2 regular `ring()` bands (`BAND_SIZE`), slightly above center                                                                                                | count                                 |
| 5    | Crosshatch                             | two mirrored sets of straight 45° diagonals (`HATCH_SIZE` stroke), fixed spacing, drawn flat, ends overshooting the clip                                                        | nothing                               |
| 6    | Diagonal stripes                       | one set of straight 45° diagonals (`DIAG_SIZE` stroke, fixed spacing) — crosshatch minus the mirror                                                                             | slant direction                       |
| 7    | Spiral                                 | one archimedean spiral polyline (`SPIRAL_SIZE` stroke, `SPIRAL_GAP` turn spacing) growing from the label center, eye pinned to the center, drooped per point                    | nothing                               |
| 8    | Sunburst                               | `BURST_RAYS` wedge rays radiating from the label center, filling half the circle, overshooting the clip, drawn flat                                                             | nothing                               |
| 9–13 | Hearts / Clubs / Stars / Rings / Bolts | `symbolGrid()` of one path from `SHAPES` (see below)                                                                                                                            | nothing                               |
| 14   | Diagonal split                         | label's bottom-right half in the pattern color, corner to corner; the split line is a quadratic bowed by `SPLIT_CURVE` toward the pattern side, so it reads concave; drawn flat | nothing                               |
| 15   | Wavy split                             | label's bottom half in the pattern color; the top boundary is a small three-peak wave, drooped per point                                                                        | nothing                               |

Every dimension above is a hand-tweakable constant in the knobs block at the top of `src/index.ts`; seeded draws only vary count/spacing/offset/direction around them.

**Symbol grid**: the five symbol patterns share `symbolGrid()` — the polkadot layout applied to one origin-centered path from `SHAPES` (each ~16 units half-width, scaled by `SHAPE_SIZE`). Columns sit at equal _angular_ intervals around the cylinder (`x = CX − RX·cos θ`), so on-screen spacing compresses toward the edges; each shape takes its vertical drop from the same angle (`PATTERN_CURVE·sin θ`) and is foreshortened horizontally by `sin θ`, which exactly cancels the edge compression — perceived gaps stay uniform, and squashed edge shapes read as the pattern continuing around the can. (A flat x-grid + droop made edge shapes bunch up and merge into blobs.) Staggered rows give the zigzag. Adding a new symbol pattern is one path in `SHAPES` plus a one-line case.

Dropped along the way: checker (drooped quads read as noise at avatar sizes), vertical stripes (gave way to crosshatch), plaid (became the spiral), a plain no-pattern type (became the diagonal split), and a seed-cycled single "symbols" type (split into per-shape types to grow the count).

## Tooling

ESM-only. `tsc --emitDeclarationOnly` produces the `.d.ts` (still a full type-check) and esbuild transpiles + minifies the JS into `dist/` (per-file, not bundled, so the `index.js` → `template.js` import is preserved as a normal ESM package). esbuild and Prettier are **dev** dependencies only — the published package has zero runtime deps. CJS output deliberately skipped — add via `tsup` only if a real consumer needs it.

The demo (`scripts/demo.mjs`) bundles the library from source with esbuild in-memory rather than reading `dist/`, so it is independent of the minified build; `npm run dev` watches `src/` and rewrites `index.html` on every save.

## Verification

- `node:test` (`test/`, run against `dist/`): determinism (same seed twice), divergence (different seeds), SVG structure, the `size` and `background` options, empty-seed validity, the theme knobs (grayscale at saturation 0, hue rotation moving only hues, defaults unchanged), the legibility guard (pattern stays lighter than the can on a dark grayscale palette), and a golden-hash test freezing the output format (update the hashes only for deliberate, breaking visual changes).
- `npm run demo` → `index.html` with a 64-can gallery and a live seed tester (sizes 128→32, background switcher, hue/saturation/lightness sliders) for eyeballing variety, contrast, and pattern legibility at avatar sizes. Committed image snapshots were skipped while visuals are still being tuned; the golden-hash test is the lighter-weight format guard used instead.

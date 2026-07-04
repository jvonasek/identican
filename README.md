# Identican

Deterministic soda-can identicons. Give it any string, get back a unique soda can as an SVG.

Each can varies by:

- Background color
- Can color
- Pattern

Zero dependencies.

Example: https://jvonasek.github.io/identican

## Install

```sh
npm install identican
```

## Usage

```ts
import { identican } from "identican"

const svg = identican("user@example.com") // "<svg …>…</svg>"
```

Drop it in the DOM:

```ts
el.innerHTML = identican("user@example.com", { size: 64 })
```

As an `<img>` source:

```ts
img.src = identicanDataUri(seed)
```

In React:

```tsx
<div dangerouslySetInnerHTML={{ __html: identican(user.id, { size: 48 }) }} />
```

## API

### `identican(seed: string, options?): string`

Returns SVG markup as a string.

| Option       | Type                              | Default      | Description                                                                                      |
| ------------ | --------------------------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| `size`       | `number`                          | `128`        | `width`/`height` attributes in px. The SVG has a `viewBox`, so it scales to any size regardless. |
| `background` | `"gradient" \| "solid" \| "none"` | `"gradient"` | Background fill: seeded diagonal gradient, a solid seeded color, or none (transparent).          |
| `title`      | `string`                          | —            | Accessible name (`aria-label`). Omitted = `aria-hidden="true"` (decorative)                      |
| `hue`        | `number`                          | `0`          | Degrees added to every color's hue, rotating the whole palette around the wheel.                 |
| `saturation` | `number`                          | `1`          | Multiplier on every color's saturation. `0` = grayscale, `>1` more vivid.                        |
| `lightness`  | `number`                          | `1`          | Multiplier on every color's lightness. `<1` darker/moodier, `>1` lighter/pastel.                 |

Any string is a valid seed, including the empty string. Output is fully deterministic — no `Math.random`, no time. Identical bytes across engines in practice; see `docs/DESIGN.md` for the one theoretical caveat (trig rounding).

### `identicanDataUri(seed: string, options?): string`

`identican()` output wrapped as a `data:image/svg+xml` URI, for `<img src>` / CSS `url()`.

## How it works

The seed is hashed (FNV-1a 32-bit) into the state of a small seeded PRNG (mulberry32). A fixed sequence of draws picks the background hue, the complementary can hue, the pattern type, and the pattern's color and geometry. The can itself is hand-drawn line art (`soda-can.svg`); the library paints the seeded colors and pattern underneath it — the pattern clipped to the can's side and warped to follow the cylinder's curvature — then draws the black outline on top.

## Development

```sh
npm run build    # build the library
npm run test     # unit tests
npm run demo     # writes index.html
```

## License

MIT

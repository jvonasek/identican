# Identican

Deterministic soda-can identicons. Give it any string, get back a unique soda can as an SVG.

Each can varies by:

- Background color
- Can color
- Pattern

Zero dependencies.

## Live Demo

Try it here: https://jvonasek.github.io/identican

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
const src = useMemo(() => identicanDataUri(user.id, { size: 48 }), [user.id])
return <img src={src} alt={user.name} />
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

The seed is hashed (FNV-1a 32-bit) into the state of a small seeded PRNG (mulberry32). A fixed sequence of draws picks the background hue, the contrasting can hue, the pattern type, and the pattern's color and geometry.

## Performance

`identican()` (and `identicanDataUri()`) is pure — the same seed and options always produce identical output — so results are memoized in a bounded FIFO cache. Repeated calls with the same arguments return the cached string without recomputing.

## Development

```sh
npm run build    # build the library
npm run test     # unit tests
npm run demo     # writes index.html
```

## License

MIT

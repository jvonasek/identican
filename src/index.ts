import { TEMPLATE_D } from "./template.js"
import { lum, deriveStop } from "./color.js"
import { fnv1a, mulberry32 } from "./rng.js"
import { hsl, esc, n } from "./util.js"
import { CAN_SCALE, SILHOUETTE_D, LABEL_D } from "./can.js"
import { pattern } from "./patterns/index.js"
import { paletteRoleRand, pickColor, pickContrastingColor, pickBackgroundColor } from "./palette.js"

/** Custom color pools. When an array is set, its layer's color is picked from
 * the array (seeded, from a per-layer RNG that never disturbs the can's
 * geometry) instead of being derived from the seed's hue. Colors are used
 * verbatim — the `saturation`/`lightness` knobs don't apply. The background
 * gradient's first stop is a random pick from `backgrounds`, re-rolled toward
 * the can's complement only when the pick lands too close in hue to the can (so
 * the can never blends in while variety is otherwise kept); its second stop is
 * *derived* from that pick (hue rotated a third of the wheel and darkened), not
 * a separate pool color. `patterns` is filtered to the
 * colors that contrast the chosen can color (highest-contrast if none clear the
 * bar), so the pattern stays visible. */
export interface IdenticanPalette {
  backgrounds?: string[]
  cans?: string[]
  patterns?: string[]
}

export interface IdenticanOptions {
  /** Width/height attributes in px. The SVG has a viewBox, so it scales regardless. Default 128. */
  size?: number
  /** Background fill: seeded diagonal gradient (default), a solid seeded color, or none (transparent). */
  background?: "gradient" | "solid" | "none"
  /** Accessible name announced by screen readers. When omitted the SVG is aria-hidden (decorative). */
  title?: string
  /** Multiplier on every color's saturation. 1 (default) = normal, 0 = grayscale, >1 more vivid. */
  saturation?: number
  /** Multiplier on every color's lightness. 1 (default) = normal, <1 darker/moodier, >1 lighter/pastel. */
  lightness?: number
  /** Zoom the viewBox: 1 (default) fills the frame, >1 zooms in, <1 zooms out. The vertical pan tracks the zoom automatically. */
  zoom?: number
  /** Custom color pools per layer; see {@link IdenticanPalette}. Layers with no
   * array keep their seeded color. */
  palette?: IdenticanPalette
}

const getZoomViewBox = (zoom: number): { x: number; y: number; size: number } => {
  const size = 1524 / zoom
  // zooming in pans up to keep the can framed); zooming out stays centered. x is always centered.
  const yOffset = zoom > 1 ? -33 * (zoom - 1) : 0
  return {
    x: (0.5 - 0.5 / zoom) * 1524,
    y: (0.5 - 0.5 / zoom + yOffset / 100) * 1524,
    size,
  }
}

// Memoization: identican is pure (same inputs → identical SVG), so results are
// cached. Bounded FIFO — drop the oldest entry past the cap; an LRU isn't worth it.
const CACHE_MAX = 1000
const cache = new Map<string, string>()

/** Generate a deterministic soda-can identicon for a seed string, as an SVG markup string. */
export function identican(seed: string, options: IdenticanOptions = {}): string {
  const {
    size = 128,
    background = "gradient",
    title,
    saturation = 1,
    lightness = 1,
    zoom = 1,
    palette,
  } = options
  // Effective palette pools: an absent or empty array is no pool at all, so
  // `palette: {}` / empty arrays behave exactly like omitting the option.
  const bgPool = palette?.backgrounds?.length ? palette.backgrounds : undefined
  const canPool = palette?.cans?.length ? palette.cans : undefined
  const patPool = palette?.patterns?.length ? palette.patterns : undefined
  // "" when no effective palette — the cache key and def-id strings must stay
  // character-identical to the pre-palette format or every existing
  // identicon's bytes change (the golden-hash test guards this).
  const palKey =
    bgPool || canPool || patPool
      ? "|" + JSON.stringify([bgPool ?? 0, canPool ?? 0, patPool ?? 0])
      : ""
  const key = [seed, size, background, saturation, lightness, title, zoom].join(" ") + palKey
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const sizeN = Number(size)
  const sizeAttr = Number.isFinite(sizeN) ? sizeN : 128
  const hash = fnv1a(seed)
  const rand = mulberry32(hash)
  const id = `ci${hash.toString(36)}-${fnv1a(`${background}|${saturation}|${lightness}|${zoom}${palKey}`).toString(36)}`
  const viewBox = getZoomViewBox(zoom)

  // every color funnels through this, so the two knobs shift the whole
  // palette together; render-time only, no PRNG draws involved
  const col = (h: number, s: number, l: number): string =>
    hsl(
      h,
      Math.min(100, Math.max(0, s * saturation)),
      // cap below 100 so a high lightness knob never washes a color to pure
      // white — keep at least a sliver of the hue
      Math.min(92, Math.max(0, l * lightness)),
    )

  // fixed draw order — see note on mulberry32
  // Complementary scheme: background → baseHue; can → a seeded soft-split
  // complement of the background (150/165/195/210° off — always ≥150°, so the
  // can never blends into the background); the pattern takes one of the can
  // color's triadic hues (±120°, seeded).
  // 20 discrete background hues, 18° apart (360/20) — a clean but varied wheel.
  // The can offset and the ±120° triad are not multiples of 18, so the can and
  // pattern hues sit off the background wheel; that's deliberate — it adds
  // variety while the large background area stays on the clean grid.
  const baseHue = Math.floor(rand() * 20) * 18
  const canOffset = [150, 165, 195, 210][Math.floor(rand() * 4)]
  const patternType = Math.floor(rand() * 20)
  const canHue = baseHue + canOffset
  const patternHue = canHue + (rand() < 0.5 ? 120 : -120)
  const patternSat = 55 + rand() * 25
  const patternL = 50 + rand() * 10

  const ps = Math.min(100, Math.max(0, patternSat * saturation))
  let pl = Math.min(100, Math.max(0, patternL * lightness))
  const cs = Math.min(100, Math.max(0, 60 * saturation))
  const cl = Math.min(100, Math.max(0, 52 * lightness))
  const canL = lum(canHue, cs, cl)
  const sep = (l: number): number => lum(patternHue, ps, l) - canL
  // At full saturation the pattern's hue (120° off the can) separates it on its
  // own, so the brightness lift is only needed as saturation drops toward
  // grayscale, where hue vanishes and only lightness tells pattern from can.
  // Fade the lift to zero by saturation 0.6 (above that we trust the hue), and
  // scale it with the lightness knob so a dark palette gets a proportional,
  // non-glowing lift. lum rises monotonically with l, so lifting up always
  // separates better than dropping down — hence the single-direction bump.
  const lift = 35 * Math.min(1, lightness) * Math.max(0, 1 - saturation / 0.6)
  if (lift > 0 && sep(pl) < 0.15) pl = Math.min(100, pl + lift)

  // Seeded defaults (auto mode). A no-palette call uses these verbatim and
  // touches none of the palette RNGs below, so its output is byte-identical to
  // before the palette feature (the golden-hash test guards this).
  const defaultPatternColor = hsl(patternHue, ps, pl)
  // stop A doubles as the solid background, so solid and gradient stay consistent;
  // stop B is derived from A (see below), never seeded on its own
  const defaultBgA = col(baseHue, 72, 74)
  const defaultCanColor = col(canHue, 60, 52)

  // Custom palette (when a pool is set): each layer picks from its own RNG so
  // the choices never disturb the main draw sequence above. Background gets two
  // distinct gradient stops; the pattern is chosen to contrast the can so it
  // stays visible.
  const bgRand = paletteRoleRand(seed, "background")
  const canRand = paletteRoleRand(seed, "can")
  const patRand = paletteRoleRand(seed, "pattern")
  // The can is picked first so the background can be checked against it.
  const canColor = pickColor(canPool, canRand, defaultCanColor)
  // Stop A is the seeded default, or — from a custom `backgrounds` pool — a
  // random pick, re-rolled toward the complement only when it lands too close
  // in hue to the can. Stop B is derived from A — hue rotated a third of the
  // wheel and darkened — so the two stops always share a family and the darker
  // one sits on the bottom (offset 1) by construction.
  const bgA = pickBackgroundColor(bgPool, bgRand, canColor, defaultBgA)
  const bgB = deriveStop(bgA)
  const patternColor = pickContrastingColor(patPool, patRand, canColor, defaultPatternColor, 1.8)

  const bgFill = background === "gradient" ? `url(#${id}-bg)` : bgA
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sizeAttr}" height="${sizeAttr}" viewBox="${n(viewBox.x)} ${n(viewBox.y)} ${n(viewBox.size)} ${n(viewBox.size)}" role="img" ${
      title ? `aria-label="${esc(String(title))}"` : `aria-hidden="true"`
    }>` +
    `<defs>` +
    (background === "gradient"
      ? `<linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0.25" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/>` +
        `</linearGradient>`
      : "") +
    `<linearGradient id="${id}-hl">` +
    `<stop offset="0" stop-color="#000" stop-opacity=".18"/>` +
    `<stop offset=".18" stop-color="#fff" stop-opacity=".25"/>` +
    `<stop offset=".38" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset=".82" stop-color="#000" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity=".22"/>` +
    `</linearGradient>` +
    `<clipPath id="${id}-clip"><path d="${LABEL_D}"/></clipPath>` +
    `</defs>` +
    (background === "none"
      ? ""
      : `<rect x="${n(viewBox.x)}" y="${n(viewBox.y)}" width="${n(viewBox.size)}" height="${n(viewBox.size)}" fill="${bgFill}"/>`) +
    `<g transform="translate(${n(762 * (1 - CAN_SCALE))} ${n(762 * (1 - CAN_SCALE))}) scale(${CAN_SCALE}) translate(309 0)">` +
    `<path d="${SILHOUETTE_D}" fill="${canColor}"/>` +
    `<ellipse cx="458" cy="242" rx="267" ry="70" fill="${canColor}"/>` +
    `<ellipse cx="458" cy="237" rx="258" ry="55" fill="#ccd1d5"/>` +
    `<ellipse cx="325" cy="185" rx="125" ry="30" transform="rotate(20 325 185)" fill="#ccd1d5"/>` +
    // Filler: the tab ellipse above falls a few px short of the black rim along
    // the tab's top-right edge, leaving a thin background sliver between rim and
    // lid. This tiny grey ellipse reaches up under the rim to close it; the line
    // art covers everything above, so it can't itself leak past the black.
    `<ellipse cx="312" cy="146" rx="36" ry="11" transform="rotate(20 312 146)" fill="#ccd1d5"/>` +
    // Tab-tongue ellipse, pulled in from the left (cx 309 / rx 86) so its pointed
    // end stays inside the black tab outline instead of poking grey past it.
    `<ellipse cx="309" cy="208" rx="86" ry="26" transform="rotate(20 309 208)" fill="#ccd1d5"/>` +
    `<g clip-path="url(#${id}-clip)">` +
    pattern(patternType, rand, patternColor) +
    `</g>` +
    `<path d="${LABEL_D}" fill="url(#${id}-hl)"/>` +
    // Close the top-left seam: the body's shoulder outline stops just short of the
    // lid, leaving a thin concave notch where the background shows between the
    // shoulder line and the lid. This tiny black wedge bridges that gap so the
    // outline reads as continuous into the lid. Drawn under the line art (same #000).
    `<path d="M186 249 L199 259 L191 265 Z" fill="#000"/>` +
    `<path d="${TEMPLATE_D}" fill="#000" fill-rule="evenodd"/>` +
    `</g>` +
    `</svg>`
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
  cache.set(key, svg)
  return svg
}

/** identican() output as a data: URI, ready to use as an <img> src. */
export function identicanDataUri(seed: string, options: IdenticanOptions = {}): string {
  return "data:image/svg+xml;utf8," + encodeURIComponent(identican(seed, options))
}

/** Theme options fixed for the lifetime of an {@link Identican} instance. */
export type IdenticanTheme = Pick<
  IdenticanOptions,
  "background" | "saturation" | "lightness" | "zoom" | "palette"
>

/** Per-generation options, passed on each call to an {@link Identican} instance. */
export type RenderOptions = Pick<IdenticanOptions, "size" | "title">

/** A single generation. Render lazily to whichever format you need. */
export interface IdenticanResult {
  /** SVG markup string — same as `identican(seed, { ...theme, ...renderOptions })`. */
  toSvg(): string
  /** `data:image/svg+xml` URI — same as `identicanDataUri(seed, { ...theme, ...renderOptions })`. */
  toDataURL(): string
}

// Callable-instance pattern: `new Identican(theme)` returns a function you call
// as `can(seed, renderOptions)`. The interface below adds the call signature to
// the `Identican` type (declaration merging with the class); the constructor
// returns the closure in place of `this`, so the instance IS that function.
export interface Identican {
  (seed: string, options?: RenderOptions): IdenticanResult
}

/**
 * Class API with the palette theme fixed at construction. The instance is
 * callable: `new Identican(theme)(seed, renderOptions)`.
 *
 * ```ts
 * const can = new Identican({ background: "solid", lightness: 0.5 })
 * can("user@example.com", { size: 48 }).toSvg()
 * can("user@example.com", { size: 48 }).toDataURL()
 * ```
 *
 * Theme (`background`/`hue`/`saturation`/`lightness`) is set once here; render
 * options (`size`/`title`) are passed per call. Output is identical to calling
 * `identican(seed, { ...theme, ...renderOptions })` directly.
 */
export class Identican {
  constructor(theme: IdenticanTheme = {}) {
    const call = (seed: string, options: RenderOptions = {}): IdenticanResult => {
      const merged: IdenticanOptions = { ...theme, ...options }
      return {
        toSvg: () => identican(seed, merged),
        toDataURL: () => identicanDataUri(seed, merged),
      }
    }
    // The constructor returns the closure, replacing the default `this`; the
    // `interface Identican` above types the result as callable.
    return call as unknown as Identican
  }
}

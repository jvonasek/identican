// Custom-palette color picking.
//
// Each layer draws from its own seeded RNG (seed|role) so palette choices never
// disturb the main draw sequence — the can's geometry is identical whether or not
// a palette is set, and a no-palette call touches none of this. The pool's
// contents are deliberately NOT in the seed: editing a color then only re-colors
// the cans that landed on it, instead of reshuffling every pick. Picked colors are
// used verbatim (only HTML-escaped); the saturation/lightness knobs don't apply.
import { type Rand, mulberry32, fnv1a } from "./rng.js"
import { esc } from "./util.js"
import { contrastRatio, hueOf } from "./color.js"

export const paletteRoleRand = (seed: string, role: string): Rand =>
  mulberry32(fnv1a(`${seed}|${role}`))

// pick any color from the pool; fall back to the seeded default when empty
export const pickColor = (colors: string[] | undefined, rand: Rand, fallback: string): string => {
  const pool = colors?.filter(Boolean)
  if (!pool?.length) return fallback
  return esc(String(pool[Math.floor(rand() * pool.length)]))
}

// pick a color that clears `minContrast` against `compareTo`; if none does, take
// the highest-contrast one so the pattern is never invisible on the can
export const pickContrastingColor = (
  colors: string[] | undefined,
  rand: Rand,
  compareTo: string,
  fallback: string,
  minContrast: number,
): string => {
  const pool = colors?.filter(Boolean)
  if (!pool?.length) return fallback
  const ok = pool.filter((c) => contrastRatio(String(c), compareTo) >= minContrast)
  if (ok.length) return esc(String(ok[Math.floor(rand() * ok.length)]))
  return esc(
    String(
      pool.reduce((best, c) =>
        contrastRatio(String(c), compareTo) > contrastRatio(String(best), compareTo) ? c : best,
      ),
    ),
  )
}

// Minimum hue separation (degrees) we want between a custom background and the
// can before they read as blending. A background below this is "too similar".
const BG_MIN_HUE_SEP = 60

// Pick a background from the pool at random (keeping full variety), but if the
// pick lands too close in hue to the can, re-pick from the pool colors that do
// clear the separation bar — or, if none do, the most-separated (closest to the
// complement) color. Colors whose hue can't be read count as fine.
export const pickBackgroundColor = (
  colors: string[] | undefined,
  rand: Rand,
  compareTo: string,
  fallback: string,
): string => {
  const pool = colors?.filter(Boolean)
  if (!pool?.length) return fallback
  const target = hueOf(compareTo)
  // hue separation (0..180) between a color and the can; null when either hue
  // is unreadable — such colors are treated as clearing the bar
  const sep = (c: string): number | null => {
    const h = hueOf(String(c))
    if (h === null || target === null) return null
    const diff = (((h - target) % 360) + 360) % 360
    return Math.min(diff, 360 - diff)
  }
  // random pick first — this is what preserves the variance
  const pick = pool[Math.floor(rand() * pool.length)]
  const s = sep(pick)
  if (s === null || s >= BG_MIN_HUE_SEP) return esc(String(pick))
  // too similar: prefer a random one among the colors that clear the bar,
  // else fall back to the most-separated color in the pool
  const ok = pool.filter((c) => (sep(c) ?? 180) >= BG_MIN_HUE_SEP)
  if (ok.length) return esc(String(ok[Math.floor(rand() * ok.length)]))
  return esc(String(pool.reduce((best, c) => ((sep(c) ?? 0) > (sep(best) ?? 0) ? c : best))))
}

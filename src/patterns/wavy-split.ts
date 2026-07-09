import type { Rand } from "../rng.js"
import { n } from "../util.js"
import { L, EDGE_RY, PATTERN_CURVE, droop } from "../geometry.js"

// wavy split — the label's bottom half in the pattern color, from the center
// down; the top boundary is a small three-peak wave (peaks at ⅙, ½, ⅚ of the
// width), drooped onto the cylinder like the waves pattern. Nothing seeded.
export function wavySplit(_rand: Rand, color: string): string {
  const x2 = L.x + L.w
  const yMax = L.y + L.h + EDGE_RY // clip region includes the bulging bottom edge
  const amp = 40
  const mid = L.y + L.h / 3 - PATTERN_CURVE / 2
  const pts: string[] = []
  for (let px = L.x - 40; px <= x2 + 40; px += 25) {
    const t = (px - L.x) / L.w
    pts.push(`${n(px)} ${n(mid + amp * Math.cos(t * 6 * Math.PI) + droop(px))}`)
  }
  return (
    `<path d="M ${pts.join(" L ")} L ${x2 + 60} ${yMax + 60} ` +
    `L ${L.x - 60} ${yMax + 60} Z" fill="${color}"/>`
  )
}

import type { Rand } from "../rng.js"
import { n } from "../util.js"
import { L, EDGE_RY } from "../geometry.js"

const SPLIT_CURVE = 200 // diagonal split bow — control-point offset, actual bulge is half this

// diagonal split — the label's bottom-right half in the pattern color, corner to
// corner; the top-left half stays the can color. The split line is a quadratic
// bowed by SPLIT_CURVE toward the pattern side (concave). Drawn flat like the
// diagonal stripes; overshoots the clip on the right/bottom. Nothing seeded.
export function diagonalSplit(_rand: Rand, color: string): string {
  const x2 = L.x + L.w
  const y2 = L.y + L.h
  const yMax = y2 + EDGE_RY // clip region includes the bulging bottom edge
  const len = Math.hypot(L.w, L.h)
  const cx = (L.x + x2) / 2 + SPLIT_CURVE * (L.h / len)
  const cy = (L.y + y2) / 2 + SPLIT_CURVE * (L.w / len)
  return (
    `<path d="M ${L.x} ${y2} Q ${n(cx)} ${n(cy)} ${x2} ${L.y} L ${x2 + 60} ${L.y} ` +
    `L ${x2 + 60} ${yMax + 60} L ${L.x - 60} ${yMax + 60} Z" fill="${color}"/>`
  )
}

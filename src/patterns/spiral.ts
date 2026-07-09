import type { Rand } from "../rng.js"
import { n } from "../util.js"
import { L, RX, CX, PATTERN_CURVE, droop } from "../geometry.js"

const SPIRAL_SIZE = 75 // spiral stroke width
const SPIRAL_GAP = 180 // spacing between spiral turns
const SPIRAL_ROT = 5 // rotation offset in degrees (0 = eye opens to the right)

// spiral — one archimedean spiral from the label center outward, drooped onto the
// cylinder; nothing seeded, identical on every can. The droop at the can center
// is PATTERN_CURVE, so cy is set back by that much to land the spiral's eye
// exactly on the label center.
export function spiral(_rand: Rand, color: string): string {
  const cy = L.y + L.h / 2
  // enough turns to reach past the label corners; the clip trims the rest
  const maxR = Math.hypot(RX, L.h / 2) + SPIRAL_GAP
  const pts: string[] = []
  const rot = (SPIRAL_ROT * Math.PI) / 180
  for (let t = 0; t <= (maxR / SPIRAL_GAP) * 2 * Math.PI; t += 0.15) {
    const r = (SPIRAL_GAP / (2 * Math.PI)) * t
    const a = t + rot
    const px = CX + r * Math.cos(a)
    pts.push(`${n(px)},${n(cy + r * Math.sin(a))}`)
  }
  return (
    `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" ` +
    `stroke-width="${SPIRAL_SIZE}" stroke-linecap="round"/>`
  )
}

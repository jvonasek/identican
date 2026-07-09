import type { Rand } from "../rng.js"
import { n } from "../util.js"
import { L, CX, droop } from "../geometry.js"

const VEE_SIZE = 120 // V chevron stroke width

// vee — a single bold V spanning the whole label: two legs running from the top
// corners down to a point at the bottom center, drooped onto the cylinder like
// the other strokes so it wraps around the can. Reads as a V from top to bottom.
// Nothing seeded, identical on every vee can.
export function vee(_rand: Rand, color: string): string {
  const x2 = L.x + L.w
  const y2 = L.y + L.h
  const apexY = y2 - VEE_SIZE / 2 // pull the tip up so the round cap sits on the label
  const steps = 24
  const pts: string[] = []
  // top-left corner → apex
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const px = L.x + (CX - L.x) * t
    pts.push(`${n(px)},${n(L.y + (apexY - L.y) * t + droop(px))}`)
  }
  // apex → top-right corner
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const px = CX + (x2 - CX) * t
    pts.push(`${n(px)},${n(apexY - (apexY - L.y) * t + droop(px))}`)
  }
  return (
    `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" ` +
    `stroke-width="${VEE_SIZE}" stroke-linejoin="round" stroke-linecap="round"/>`
  )
}

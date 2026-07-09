import type { Rand } from "../rng.js"
import { n } from "../util.js"
import { L, RX, CX, droop } from "../geometry.js"

const CHEVRON_COUNT = 3 // number of stacked chevrons (centered in the label)
const CHEVRON_SIZE = 100 // chevron stroke thickness
const CHEVRON_SPACING = 300 // vertical distance between stacked chevron apexes
const CHEVRON_DROP = 300 // vertical drop from apex to the leg ends at the sides
const CHEVRON_BOW = 1 // leg curve exponent (<1 bows the legs outward, apex stays pointed)

// chevrons — a stack of CHEVRON_COUNT upward "^" marks: apex at the horizontal
// center, two legs sweeping down to the sides. CHEVRON_BOW < 1 bows the legs
// outward (convex) while the apex stays pointed. Each point is drooped onto the
// cylinder. The stack is centered in the label so exactly CHEVRON_COUNT render.
// Fixed geometry, nothing seeded.
export function chevrons(_rand: Rand, color: string): string {
  const x2 = L.x + L.w
  const shapes: string[] = []
  const firstApex = L.y + L.h / 2 - CHEVRON_DROP / 2 - ((CHEVRON_COUNT - 1) / 2) * CHEVRON_SPACING
  for (let i = 0; i < CHEVRON_COUNT; i++) {
    const apexY = firstApex + i * CHEVRON_SPACING + CHEVRON_SIZE / 2
    const pts: string[] = []
    for (let px = L.x - 20; px <= x2 + 20; px += 18) {
      const t = Math.min(1, Math.abs(px - CX) / RX)
      const y = apexY + CHEVRON_DROP * Math.pow(t, CHEVRON_BOW)
      pts.push(`${n(px)},${n(y + droop(px))}`)
    }
    shapes.push(
      `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="${CHEVRON_SIZE}" stroke-linejoin="round" stroke-linecap="round"/>`,
    )
  }
  return shapes.join("")
}

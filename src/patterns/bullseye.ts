import type { Rand } from "../rng.js"
import { n } from "../util.js"
import { L, RX, CX } from "../geometry.js"

const TARGET_SIZE = 75 // bullseye ring stroke width
const TARGET_GAP = 140 // spacing between bullseye rings (center to center)

// bullseye — concentric rings growing from the label center. Drawn flat (plain
// circles centered on the label), like the sunburst; the innermost gap stays
// can-color, reading as the bull's-eye. Nothing seeded.
export function bullseye(_rand: Rand, color: string): string {
  const cy = L.y + L.h / 1.7
  const maxR = Math.hypot(RX, L.h / 2) + TARGET_GAP
  const shapes: string[] = []
  for (let r = TARGET_GAP; r <= maxR; r += TARGET_GAP) {
    const pts: string[] = []
    for (let t = 0; t <= 2 * Math.PI + 0.01; t += 0.12) {
      const px = CX + r * Math.cos(t)
      pts.push(`${n(px)},${n(cy + r * Math.sin(t))}`)
    }
    shapes.push(
      `<path d="M ${pts.join(" L ")} Z" fill="none" stroke="${color}" stroke-width="${TARGET_SIZE}"/>`,
    )
  }
  return shapes.join("")
}

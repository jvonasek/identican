import type { Rand } from "../rng.js"
import { n } from "../util.js"
import { L } from "../geometry.js"

const DIAG_SIZE = 100 // diagonal stripe thickness

// diagonal stripes — one set of 45° diagonals drooped onto the cylinder; fixed
// thickness, only spacing/offset/direction vary. Ends overshoot the clip.
export function diagonalStripes(rand: Rand, color: string): string {
  const x2 = L.x + L.w
  const y2 = L.y + L.h
  const shapes: string[] = []
  const spacing = DIAG_SIZE * 3
  const dir = rand() < 0.5 ? 1 : -1
  for (let x = L.x - L.h - spacing; x < x2; x += spacing) {
    const pts: string[] = []
    const px1 = Math.min(x + L.h + 300, x2 + 100)
    for (let px = Math.max(x - 300, L.x - 100); px <= px1; px += 100) {
      const base = dir === 1 ? L.y + (px - x) : y2 - (px - x)
      pts.push(`${n(px)},${n(base)}`)
    }
    if (pts.length > 1) {
      shapes.push(
        `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="${DIAG_SIZE}"/>`,
      )
    }
  }
  return shapes.join("")
}

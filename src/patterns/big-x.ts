import type { Rand } from "../rng.js"
import { n } from "../util.js"
import { L, droop } from "../geometry.js"

const EX_SIZE = 120 // big-X stroke width

// big X — two bold diagonals corner to corner, drooped onto the cylinder.
// Nothing seeded.
export function bigX(_rand: Rand, color: string): string {
  const x2 = L.x + L.w
  const y2 = L.y + L.h
  const steps = 24
  const shapes: string[] = []
  for (const [ax, ay, bx, by] of [
    [L.x, L.y, x2, y2],
    [x2, L.y, L.x, y2],
  ]) {
    const pts: string[] = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const px = ax + (bx - ax) * t
      pts.push(`${n(px)},${n(ay + (by - ay) * t + droop(px))}`)
    }
    shapes.push(
      `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" ` +
        `stroke-width="${EX_SIZE}" stroke-linecap="round"/>`,
    )
  }
  return shapes.join("")
}

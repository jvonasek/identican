import type { Rand } from "../rng.js"
import { n } from "../util.js"
import { L, RX, CX } from "../geometry.js"

const BURST_RAYS = 8 // sunburst ray count
const BURST_SIZE = 100 // sunburst overshoot past the label corners

// sunburst — wedge rays radiating from the label center, overshooting the clip;
// nothing seeded, identical on every sunburst can. Drawn flat, dead center on
// the label.
export function sunburst(_rand: Rand, color: string): string {
  const cy = L.y + L.h / 2
  const r = Math.hypot(RX, L.h / 2) + BURST_SIZE
  const half = Math.PI / BURST_RAYS / 2 // rays fill half the circle
  const shapes: string[] = []
  for (let i = 0; i < BURST_RAYS; i++) {
    const a = (i / BURST_RAYS) * 2 * Math.PI
    shapes.push(
      `<path d="M ${CX} ${n(cy)} ` +
        `L ${n(CX + r * Math.cos(a - half))} ${n(cy + r * Math.sin(a - half))} ` +
        `L ${n(CX + r * Math.cos(a + half))} ${n(cy + r * Math.sin(a + half))} Z" fill="${color}"/>`,
    )
  }
  return shapes.join("")
}

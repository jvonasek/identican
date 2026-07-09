import type { Rand } from "../rng.js"
import { L, EDGE_RY, ring } from "../geometry.js"

const STRIPE_SIZE = 100 // horizontal stripe height

// horizontal stripes — rings around the cylinder; fixed height (STRIPE_SIZE),
// only gap and offset are seeded
export function stripes(_rand: Rand, color: string): string {
  const yMax = L.y + L.h + EDGE_RY // clip region includes the bulging bottom edge
  const shapes: string[] = []
  const sh = STRIPE_SIZE
  const gap = sh + 20
  const off = sh + gap + STRIPE_SIZE * 1.5
  for (let y = L.y - off; y < yMax; y += sh + gap) {
    shapes.push(ring(y, sh, color))
  }
  return shapes.join("")
}

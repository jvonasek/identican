import type { Rand } from "../rng.js"
import { L, ring } from "../geometry.js"

const BAND_SIZE = 182 // label band height

// thick label bands — fixed height, 1 or 2 of them, evenly spaced and symmetric
// about the label center (1 band sits dead center)
export function bands(rand: Rand, color: string): string {
  const shapes: string[] = []
  const count = 1 + Math.floor(rand() * 2)
  const size = count === 1 ? BAND_SIZE * 2 : BAND_SIZE
  for (let i = 0; i < count; i++) {
    const c = L.y + (L.h * (i + 0.45)) / count
    shapes.push(ring(c - size / 2, size, color))
  }
  return shapes.join("")
}

import type { Rand } from "../rng.js"
import { n } from "../util.js"
import { L, RX, CX, PATTERN_CURVE } from "../geometry.js"

const DOT_SIZE = 100 // polkadot radius

// polkadot — exactly 3 rows of large dots, middle row offset by half a column so
// the rows zigzag. Columns sit at equal angular intervals, and each dot is
// foreshortened horizontally by sin θ — cancelling the edge compression so the
// squashed edge dots read as the pattern continuing around the can.
// Nothing seeded — placement is identical on every polkadot can.
export function polkadot(_rand: Rand, color: string): string {
  const shapes: string[] = []
  const cols = Math.round((Math.PI * RX) / (DOT_SIZE * 3))
  for (let row = 0; row < 3; row++) {
    // droop only pushes dots down, so set the grid back up by half of it
    // to keep the pattern vertically centered on the label
    const y = L.y + (L.h * (row + 0.5)) / 3 - PATTERN_CURVE / 2
    const half = row % 2 === 1 ? 0.5 : 0
    for (let i = 0; i + half <= cols; i++) {
      const a = ((i + half) / cols) * Math.PI
      const s = Math.sin(a)
      if (s < 0.05) continue // edge-on dots are invisible slivers
      shapes.push(
        `<ellipse cx="${n(CX - RX * Math.cos(a))}" cy="${n(y + PATTERN_CURVE * s)}" ` +
          `rx="${n(DOT_SIZE * s)}" ry="${DOT_SIZE}" fill="${color}"/>`,
      )
    }
  }
  return shapes.join("")
}

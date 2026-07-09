import type { Rand } from "../rng.js"
import { n } from "../util.js"
import { L, EDGE_RY } from "../geometry.js"

const WAVE_SIZE = 100 // wave stroke width
const WAVE_Y_OFFSET = 70 // vertical shift of the wave rows
const WAVE_PHASE = 0 // horizontal phase of the sine (radians)
const WAVE_AMP = 38 // sine amplitude
const WAVE_WL = 300 // sine wavelength
const WAVE_GAP = 275 // vertical spacing between wave rows
const WAVE_OVERSHOOT = 120 // how far the polylines extend past the label edges
const WAVE_STEP = 25 // horizontal sampling step

// waves — sampled sine polylines with cylinder droop added; nothing seeded:
// every wave can has the same geometry, only colors vary
export function waves(_rand: Rand, color: string): string {
  const x2 = L.x + L.w
  const yMax = L.y + L.h + EDGE_RY // clip region includes the bulging bottom edge
  const shapes: string[] = []
  for (let y = L.y + WAVE_GAP / 2 + WAVE_Y_OFFSET; y < yMax + WAVE_AMP; y += WAVE_GAP) {
    const pts: string[] = []
    for (let px = L.x - WAVE_OVERSHOOT; px <= x2 + WAVE_OVERSHOOT; px += WAVE_STEP) {
      pts.push(`${n(px)},${n(y - WAVE_AMP * Math.sin((px / WAVE_WL) * 2 * Math.PI + WAVE_PHASE))}`)
    }
    shapes.push(
      `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="${WAVE_SIZE}"/>`,
    )
  }
  return shapes.join("")
}

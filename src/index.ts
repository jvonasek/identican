import { TEMPLATE_D } from "./template.js"
import { lum, contrastRatio, lighterFirst } from "./color.js"

/** Custom color pools. When an array is set, its layer's color is picked from
 * the array (seeded, from a per-layer RNG that never disturbs the can's
 * geometry) instead of being derived from the seed's hue. Colors are used
 * verbatim — the `saturation`/`lightness` knobs don't apply. The background
 * gradient draws two *different* colors from `backgrounds` (falling back to a
 * seeded stop when the pool has only one), and `patterns` is filtered to the
 * colors that contrast the chosen can color (highest-contrast if none clear the
 * bar), so the pattern stays visible. */
export interface IdenticanPalette {
  backgrounds?: string[]
  cans?: string[]
  patterns?: string[]
}

export interface IdenticanOptions {
  /** Width/height attributes in px. The SVG has a viewBox, so it scales regardless. Default 128. */
  size?: number
  /** Background fill: seeded diagonal gradient (default), a solid seeded color, or none (transparent). */
  background?: "gradient" | "solid" | "none"
  /** Accessible name announced by screen readers. When omitted the SVG is aria-hidden (decorative). */
  title?: string
  /** Multiplier on every color's saturation. 1 (default) = normal, 0 = grayscale, >1 more vivid. */
  saturation?: number
  /** Multiplier on every color's lightness. 1 (default) = normal, <1 darker/moodier, >1 lighter/pastel. */
  lightness?: number
  /** Zoom the viewBox: 1 (default) fills the frame, >1 zooms in, <1 zooms out. The vertical pan tracks the zoom automatically. */
  zoom?: number
  /** Custom color pools per layer; see {@link IdenticanPalette}. Layers with no
   * array keep their seeded color. */
  palette?: IdenticanPalette
}

// FNV-1a 32-bit
function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// mulberry32 PRNG — all variation is drawn from this in a fixed order.
// Reordering or adding draws changes every identicon; that's an intentional breaking change.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hsl = (h: number, s: number, l: number): string =>
  `hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(s)}% ${Math.round(l)}%)`

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const n = (v: number): number => Math.round(v * 10) / 10

const getZoomViewBox = (zoom: number): { x: number; y: number; size: number } => {
  const size = 1524 / zoom
  // zooming in pans up to keep the can framed (1 → 0%, 1.4 → -15%); zooming out stays centered. x is always centered.
  const yOffset = zoom > 1 ? -37.5 * (zoom - 1) : 0
  return {
    x: (0.5 - 0.5 / zoom) * 1524,
    y: (0.5 - 0.5 / zoom + yOffset / 100) * 1524,
    size,
  }
}

// All geometry is in the template's coordinate space (soda-can.svg, 906×1524),
// centered in a 1524×1524 square viewBox via translate(309 0).
// L is the label region on the can's side where the pattern goes — flush with the
// template's drawn body lines: shoulder line at the top, bottom outline at the bottom.
const L = { x: 126, y: 372, w: 648, h: 918 }
// Cylinder curvature: EDGE_RY matches the template's drawn rims (label clip edges).
const RX = L.w / 2
const EDGE_RY = 55
const CX = L.x + RX

// Pattern sizing knobs (template units) — tweak these by hand; seeded draws
// only vary count/spacing/offset around them.
// PATTERN_CURVE is how hard the pattern wraps around the cylinder: the
// vertical droop (in units) at the can's center. EDGE_RY flattens it to the
// drawn rims; deliberately stronger so the wrap reads clearly.
const PATTERN_CURVE = 72
const STRIPE_SIZE = 64 // horizontal stripe height
const PIN_SIZE = 50 // pinstripe thickness
const PIN_TOOTH = 60 // pinstripe saw tooth half-height
const PIN_GAP = 90 // pinstripe horizontal distance between tooth peak and valley
const PIN_PHASE = -10 // horizontal phase of the sawtooth (template units)
const DOT_SIZE = 100 // polkadot radius
const WAVE_SIZE = 100 // wave stroke width
const WAVE_Y_OFFSET = 70 // vertical shift of the wave rows
const WAVE_PHASE = 0 // horizontal phase of the sine (radians)
const BAND_SIZE = 182 // label band height
const HATCH_SIZE = 40 // crosshatch line thickness
const SPIRAL_SIZE = 92 // spiral stroke width
const SPIRAL_GAP = 184 // spacing between spiral turns
const SHAPE_SIZE = 256 // symbol half-width
const SYMBOL_Y_OFFSET = 0 // vertical shift of the symbol grid rows
const DIAG_SIZE = 100 // diagonal stripe thickness
const BURST_RAYS = 8 // sunburst ray count
const BURST_SIZE = 100 // sunburst overshoot past the label corners
const SPLIT_CURVE = 200 // diagonal split bow — control-point offset, actual bulge is half this

// Can size relative to the canvas — scaled about the canvas center (762, 762)
const CAN_SCALE = 0.9

// vertical droop of a point on the can surface at horizontal position x
const droop = (x: number): number => {
  const t = (x - CX) / RX
  return PATTERN_CURVE * Math.sqrt(Math.max(0, 1 - t * t))
}

// Map a cylinder-surface point to screen coords. a is the angle along the
// visible front arc (0 = left rim, π/2 = center, π = right rim); v is height
// on the flat label. Same parameterization as the polkadot/symbol grid.
const onCylinder = (a: number, v: number): [number, number] => [
  CX - RX * Math.cos(a),
  v + PATTERN_CURVE * Math.sin(a),
]

// horizontal band with elliptical top/bottom edges — a ring around the cylinder
function ring(y: number, h: number, fill: string): string {
  const x2 = L.x + L.w
  return (
    `<path d="M ${L.x} ${n(y)} A ${RX} ${PATTERN_CURVE} 0 0 0 ${x2} ${n(y)} ` +
    `L ${x2} ${n(y + h)} A ${RX} ${PATTERN_CURVE} 0 0 1 ${L.x} ${n(y + h)} Z" fill="${fill}"/>`
  )
}

// symbol shapes centered at the origin, half-width ~16 — scaled per use
const SHAPES = [
  // heart
  "M0 14 C-8 6 -16 0 -16 -6 C-16 -11 -13 -14 -8 -14 C-5 -14 -2 -12 0 -9 " +
    "C2 -12 5 -14 8 -14 C13 -14 16 -11 16 -6 C16 0 8 6 0 14 Z",
  // club — three lobes and a flared stem, single outline
  "M2.8 -1.5 C4.7 -4.4 6.4 -7 6.4 -9.6 C6.4 -13.1 3.5 -16 0 -16 " +
    "C-3.5 -16 -6.4 -13.1 -6.4 -9.6 C-6.4 -7 -4.7 -4.4 -2.8 -1.5 " +
    "C-2.7 -1.3 -2.6 -1.2 -2.5 -1 C-2.9 -1.3 -3.4 -1.6 -3.8 -2 " +
    "C-6 -3.7 -7.4 -4.8 -9.6 -4.8 C-13.1 -4.8 -16 -1.9 -16 1.6 " +
    "C-16 5.1 -13.1 8 -9.6 8 C-7 8 -4.4 6.3 -1.5 4.4 " +
    "C-1.6 8.1 -3 10.3 -4.5 12.8 C-4.7 13.1 -4.9 13.4 -5.1 13.7 " +
    "C-5.8 14.8 -5 16 -3.8 16 L3.8 16 C5 16 5.8 14.8 5.1 13.7 " +
    "C4.9 13.4 4.7 13.1 4.5 12.8 C3 10.3 1.6 8.1 1.5 4.4 " +
    "C4.4 6.3 7 8 9.6 8 C13.1 8 16 5.1 16 1.6 C16 -1.9 13.1 -4.8 9.6 -4.8 " +
    "C7.4 -4.8 6 -3.7 3.8 -2 C3.4 -1.6 2.9 -1.3 2.5 -1 C2.6 -1.2 2.7 -1.3 2.8 -1.5 Z",
  // five-point star with rounded tips (quadratic curves at every vertex)
  "M-1.6 -13.3 Q0 -17 1.6 -13.3 L3.1 -10.2 Q4.7 -6.5 8.7 -6 L12.2 -5.7 " +
    "Q16.2 -5.3 13.2 -2.5 L10.6 -0.2 Q7.6 2.5 8.4 6.4 L9.2 9.8 Q10 13.8 6.5 11.7 " +
    "L3.5 10 Q0 8 -3.5 10 L-6.5 11.7 Q-10 13.8 -9.2 9.8 L-8.4 6.4 Q-7.6 2.5 -10.6 -0.2 " +
    "L-13.2 -2.5 Q-16.2 -5.3 -12.2 -5.7 L-8.7 -6 Q-4.7 -6.5 -3.1 -10.2 Z",
  // ring — outer circle with a punched-out center (opposite winding)
  "M0 -16 A16 16 0 1 1 0 16 A16 16 0 1 1 0 -16 Z " + "M0 -8 A8 8 0 1 0 0 8 A8 8 0 1 0 0 -8 Z",
  // lightning bolt
  "M7.8 -13.1 C8.1 -13.9 7.8 -14.9 7.1 -15.5 C6.4 -16 5.3 -16 4.6 -15.3 " +
    "L-11.2 -1.5 C-11.8 -0.9 -12 -0.1 -11.8 0.7 C-11.5 1.5 -10.7 2 -9.9 2 L-3 2 " +
    "L-7.8 13.1 C-8.1 13.9 -7.8 14.9 -7.1 15.5 C-6.4 16 -5.3 16 -4.6 15.3 " +
    "L11.2 1.5 C11.8 0.9 12 0.1 11.8 -0.7 C11.5 -1.5 10.7 -2 9.9 -2 L3 -2 Z",
]

type Rand = () => number

// Custom-palette picking. Each layer draws from its own seeded RNG
// (seed|role|colors) so palette choices never disturb the main draw sequence —
// the can's geometry is identical whether or not a palette is set, and a
// no-palette call touches none of this. Picked colors are used verbatim
// (only HTML-escaped); the saturation/lightness knobs don't apply to them.
const paletteRoleRand = (seed: string, role: string, colors?: string[]): Rand =>
  mulberry32(fnv1a(`${seed}|${role}|${colors?.join(",") ?? ""}`))

// pick any color from the pool; fall back to the seeded default when empty
const pickColor = (colors: string[] | undefined, rand: Rand, fallback: string): string => {
  const pool = colors?.filter(Boolean)
  if (!pool?.length) return fallback
  return esc(String(pool[Math.floor(rand() * pool.length)]))
}

// pick a color different from `compareTo` (so the two gradient stops differ)
const pickDifferentColor = (
  colors: string[] | undefined,
  rand: Rand,
  compareTo: string,
  fallback: string,
): string => {
  const pool = colors?.filter((c) => c && esc(String(c)) !== compareTo)
  if (!pool?.length) return fallback
  return esc(String(pool[Math.floor(rand() * pool.length)]))
}

// pick a color that clears `minContrast` against `compareTo`; if none does,
// take the highest-contrast one so the pattern is never invisible on the can
const pickContrastingColor = (
  colors: string[] | undefined,
  rand: Rand,
  compareTo: string,
  fallback: string,
  minContrast: number,
): string => {
  const pool = colors?.filter(Boolean)
  if (!pool?.length) return fallback
  const ok = pool.filter((c) => contrastRatio(String(c), compareTo) >= minContrast)
  if (ok.length) return esc(String(ok[Math.floor(rand() * ok.length)]))
  return esc(
    String(
      pool.reduce((best, c) =>
        contrastRatio(String(c), compareTo) > contrastRatio(String(best), compareTo) ? c : best,
      ),
    ),
  )
}

// polkadot-style grid of one SHAPES symbol: columns at equal angular
// intervals, staggered rows, sin θ foreshortening at the edges. Fixed
// placement, nothing seeded — shared by all the shape-based patterns.
function symbolGrid(shape: number, color: string): string {
  const yMax = L.y + L.h + EDGE_RY
  const step = SHAPE_SIZE * 3
  const cols = Math.round((Math.PI * RX) / step)
  const k = SHAPE_SIZE / 16 // unit shapes have half-width ~16
  const shapes: string[] = []
  let row = 0
  for (let y = L.y - step / 2 + SYMBOL_Y_OFFSET; y < yMax + step; y += step, row++) {
    const half = row % 2 === 1 ? 0.5 : 0
    for (let i = 0; i + half <= cols; i++) {
      const a = ((i + half) / cols) * Math.PI
      const s = Math.sin(a)
      if (s < 0.05) continue // edge-on symbols are invisible slivers
      shapes.push(
        `<path d="${SHAPES[shape]}" transform="translate(${n(CX - RX * Math.cos(a))} ` +
          `${n(y + PATTERN_CURVE * s)}) scale(${n(k * s)} ${n(k)})" fill="${color}"/>`,
      )
    }
  }
  return shapes.join("")
}

function pattern(type: number, rand: Rand, color: string): string {
  const x2 = L.x + L.w
  const y2 = L.y + L.h
  const yMax = y2 + EDGE_RY // clip region includes the bulging bottom edge
  const shapes: string[] = []
  switch (type) {
    case 0: {
      // horizontal stripes — rings around the cylinder; fixed height
      // (STRIPE_SIZE), only gap and offset are seeded
      const sh = STRIPE_SIZE
      const gap = sh + 20
      const off = sh + gap + STRIPE_SIZE * 1.5
      for (let y = L.y - off; y < yMax; y += sh + gap) {
        shapes.push(ring(y, sh, color))
      }
      return shapes.join("")
    }
    case 1: {
      // sawtooth — thin saw-toothed lines (sharp zigzag),
      // fixed thickness and tooth size, evenly spaced, drooped onto the
      // cylinder; the count draw always collapses to 5 (floor(rand()+2) is
      // always 2) — kept anyway because dropping a draw would shift every
      // later draw and change every existing identicon, see DESIGN.md
      const count = 3 + Math.floor(rand() + 2)
      const step = (L.h + EDGE_RY) / count
      const pinAnchor = L.x - 20
      for (let i = 0; i < count; i++) {
        const base = L.y + (i + 0.5) * step
        const pts: string[] = []
        for (let px = pinAnchor + PIN_PHASE; px <= x2 + 20 + PIN_GAP; px += PIN_GAP) {
          const tooth = Math.floor((px - pinAnchor) / PIN_GAP)
          pts.push(`${n(px)},${n(base + (tooth % 2 ? PIN_TOOTH : -PIN_TOOTH) + droop(px))}`)
        }
        shapes.push(
          `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="${PIN_SIZE}"/>`,
        )
      }
      return shapes.join("")
    }
    case 2: {
      // waves — sampled sine polylines with cylinder droop added;
      // nothing seeded: every wave can has the same geometry, only colors vary
      const amp = 38
      const wl = 300
      const gap = 275
      for (let y = L.y + gap / 2 + WAVE_Y_OFFSET; y < yMax + amp; y += gap) {
        const pts: string[] = []
        for (let px = L.x - 20; px <= x2 + 20; px += 25) {
          pts.push(`${n(px)},${n(y - amp * Math.sin((px / wl) * 2 * Math.PI + WAVE_PHASE))}`)
        }
        shapes.push(
          `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="${WAVE_SIZE}"/>`,
        )
      }
      return shapes.join("")
    }
    case 3: {
      // polkadot — exactly 3 rows of large dots, middle row offset by half
      // a column so the rows zigzag. Columns sit at equal angular intervals,
      // and each dot is foreshortened horizontally by sin θ — cancelling the
      // edge compression so the squashed edge dots read as the pattern
      // continuing around the can.
      // Nothing seeded — placement is identical on every polkadot can.
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
    case 4: {
      // thick label bands — fixed height, 1 or 2 of them, evenly spaced and
      // symmetric about the label center (1 band sits dead center)
      const count = 1 + Math.floor(rand() * 2)
      const size = count === 1 ? BAND_SIZE * 2 : BAND_SIZE
      for (let i = 0; i < count; i++) {
        const c = L.y + (L.h * (i + 0.45)) / count
        shapes.push(ring(c - size / 2, size, color))
      }
      return shapes.join("")
    }
    case 5: {
      // crosshatch — two mirrored sets of 45° diagonals on the cylinder
      // unwrap (straight in arc×height space, then mapped through
      // onCylinder); fixed thickness, only spacing varies. Each family is
      // phase-anchored to its rim corner (slash → top-left at a=0,
      // backslash → top-right at a=π); arc range slightly overshoots [0, π]
      // for clean stroke clipping at the sides.
      const spacing = HATCH_SIZE * 7
      const v0Step = spacing * Math.SQRT2
      const arcOvershoot = (EDGE_RY + HATCH_SIZE) / RX
      const a0 = -arcOvershoot
      const a1 = Math.PI + arcOvershoot
      const steps = Math.ceil(((a1 - a0) * RX) / 30)
      const v0First = L.y - Math.ceil((L.h + spacing) / v0Step) * v0Step
      const v0Last = L.y + L.h + spacing + RX * Math.PI
      for (const dir of [1, -1]) {
        const v0Off = dir === 1 ? 0 : RX * Math.PI
        for (let v0 = v0First + v0Off; v0 < v0Last + v0Off; v0 += v0Step) {
          const pts: string[] = []
          for (let i = 0; i <= steps; i++) {
            const a = a0 + (i / steps) * (a1 - a0)
            const v = dir === 1 ? v0 + RX * a : v0 - RX * a
            const [px, py] = onCylinder(a, v)
            pts.push(`${n(px)},${n(py)}`)
          }
          shapes.push(
            `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="${HATCH_SIZE}"/>`,
          )
        }
      }
      return shapes.join("")
    }
    case 6: {
      // diagonal stripes — one set of 45° diagonals drooped onto the
      // cylinder (crosshatch minus the mirror); fixed thickness, only
      // spacing/offset/direction vary. Ends overshoot the clip.
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
    case 7: {
      // spiral — one archimedean spiral from the label center outward,
      // drooped onto the cylinder; nothing seeded, identical on every can.
      // The droop at the can center is PATTERN_CURVE, so cy is set back by
      // that much to land the spiral's eye exactly on the label center.
      const cy = L.y + L.h / 2 - PATTERN_CURVE
      // enough turns to reach past the label corners; the clip trims the rest
      const maxR = Math.hypot(RX, L.h / 2) + SPIRAL_GAP
      const pts: string[] = []
      for (let t = 0; t <= (maxR / SPIRAL_GAP) * 2 * Math.PI; t += 0.15) {
        const r = (SPIRAL_GAP / (2 * Math.PI)) * t
        const px = CX + r * Math.cos(t)
        pts.push(`${n(px)},${n(cy + r * Math.sin(t) + droop(px))}`)
      }
      return (
        `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" ` +
        `stroke-width="${SPIRAL_SIZE}" stroke-linecap="round"/>`
      )
    }
    case 8: {
      // sunburst — wedge rays radiating from the label center, overshooting
      // the clip; nothing seeded, identical on every sunburst can. Drawn
      // flat, dead center on the label.
      const cy = L.y + L.h / 2
      const r = Math.hypot(RX, L.h / 2) + BURST_SIZE
      const half = Math.PI / BURST_RAYS / 2 // rays fill half the circle
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
    case 9: {
      // hearts — symbolGrid of the heart shape
      return symbolGrid(0, color)
    }
    case 10: {
      // clubs — symbolGrid of the club shape
      return symbolGrid(1, color)
    }
    case 11: {
      // stars — symbolGrid of the rounded star shape
      return symbolGrid(2, color)
    }
    case 12: {
      // rings — symbolGrid of the ring shape
      return symbolGrid(3, color)
    }
    case 13: {
      // bolts — symbolGrid of the lightning bolt shape
      return symbolGrid(4, color)
    }
    case 14: {
      // diagonal split — the label's bottom-right half in the pattern color,
      // corner to corner; the top-left half stays the can color. The split
      // line is a quadratic bowed by SPLIT_CURVE toward the pattern side
      // (concave). Drawn flat like the diagonal stripes; overshoots the
      // clip on the right/bottom. Nothing seeded.
      const len = Math.hypot(L.w, L.h)
      const cx = (L.x + x2) / 2 + SPLIT_CURVE * (L.h / len)
      const cy = (L.y + y2) / 2 + SPLIT_CURVE * (L.w / len)
      return (
        `<path d="M ${L.x} ${y2} Q ${n(cx)} ${n(cy)} ${x2} ${L.y} L ${x2 + 60} ${L.y} ` +
        `L ${x2 + 60} ${yMax + 60} L ${L.x - 60} ${yMax + 60} Z" fill="${color}"/>`
      )
    }
    default: {
      // wavy split — the label's bottom half in the pattern color, from the
      // center down; the top boundary is a small three-peak wave (peaks at
      // ⅙, ½, ⅚ of the width), drooped onto the cylinder like the waves
      // pattern. Nothing seeded.
      const amp = 40
      const mid = L.y + L.h / 3 - PATTERN_CURVE / 2
      const pts: string[] = []
      for (let px = L.x - 40; px <= x2 + 40; px += 25) {
        const t = (px - L.x) / L.w
        pts.push(`${n(px)} ${n(mid + amp * Math.cos(t * 6 * Math.PI) + droop(px))}`)
      }
      return (
        `<path d="M ${pts.join(" L ")} L ${x2 + 60} ${yMax + 60} ` +
        `L ${L.x - 60} ${yMax + 60} Z" fill="${color}"/>`
      )
    }
  }
}

// Approximate silhouette of the template can, kept just inside its black outline;
// everything painted on it is covered by the line art on top. The shoulder flare
// is nearly straight in the artwork, so straight segments hug it tighter than a
// curve; the lid-ring area above is filled by a separate can-color ellipse.
const SILHOUETTE_D =
  "M 120 372 L 120 1150 L 127 1252 A 325 143 0 0 0 777 1252 L 784 1150 L 784 372 " +
  "L 784 368 L 702 264 Q 458 200 205 264 L 122 362 Z"

// label region (also the pattern clip): top and bottom edges follow the rim curvature
const LABEL_D =
  `M ${L.x} ${L.y} A ${RX} ${EDGE_RY} 0 0 0 ${L.x + L.w} ${L.y} ` +
  `L ${L.x + L.w} ${L.y + L.h} A ${RX} ${EDGE_RY} 0 0 1 ${L.x} ${L.y + L.h} Z`

// Memoization: identican is pure (same inputs → identical SVG), so results are
// cached. Bounded FIFO — drop the oldest entry past the cap; an LRU isn't worth it.
const CACHE_MAX = 1000
const cache = new Map<string, string>()

/** Generate a deterministic soda-can identicon for a seed string, as an SVG markup string. */
export function identican(seed: string, options: IdenticanOptions = {}): string {
  const {
    size = 128,
    background = "gradient",
    title,
    saturation = 1,
    lightness = 1,
    zoom = 1,
    palette,
  } = options
  // Effective palette pools: an absent or empty array is no pool at all, so
  // `palette: {}` / empty arrays behave exactly like omitting the option.
  const bgPool = palette?.backgrounds?.length ? palette.backgrounds : undefined
  const canPool = palette?.cans?.length ? palette.cans : undefined
  const patPool = palette?.patterns?.length ? palette.patterns : undefined
  // "" when no effective palette — the cache key and def-id strings must stay
  // character-identical to the pre-palette format or every existing
  // identicon's bytes change (the golden-hash test guards this).
  const palKey =
    bgPool || canPool || patPool
      ? "|" + JSON.stringify([bgPool ?? 0, canPool ?? 0, patPool ?? 0])
      : ""
  const key = [seed, size, background, saturation, lightness, title, zoom].join(" ") + palKey
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const sizeN = Number(size)
  const sizeAttr = Number.isFinite(sizeN) ? sizeN : 128
  const hash = fnv1a(seed)
  const rand = mulberry32(hash)
  const id = `ci${hash.toString(36)}-${fnv1a(`${background}|${saturation}|${lightness}|${zoom}${palKey}`).toString(36)}`
  const viewBox = getZoomViewBox(zoom)

  // every color funnels through this, so the two knobs shift the whole
  // palette together; render-time only, no PRNG draws involved
  const col = (h: number, s: number, l: number): string =>
    hsl(
      h,
      Math.min(100, Math.max(0, s * saturation)),
      // cap below 100 so a high lightness knob never washes a color to pure
      // white — keep at least a sliver of the hue
      Math.min(92, Math.max(0, l * lightness)),
    )

  // fixed draw order — see note on mulberry32
  // Complementary scheme: background → baseHue; can → a seeded soft-split
  // complement of the background (150/165/195/210° off — always ≥150°, so the
  // can never blends into the background); the pattern takes one of the can
  // color's triadic hues (±120°, seeded).
  // 20 discrete background hues, 18° apart (360/20) — a clean but varied wheel.
  // The can offset and the ±120° triad are not multiples of 18, so the can and
  // pattern hues sit off the background wheel; that's deliberate — it adds
  // variety while the large background area stays on the clean grid.
  const baseHue = Math.floor(rand() * 20) * 18
  const canOffset = [150, 165, 195, 210][Math.floor(rand() * 4)]
  const patternType = Math.floor(rand() * 16)
  const canHue = baseHue + canOffset
  const patternHue = canHue + (rand() < 0.5 ? 120 : -120)
  const patternSat = 55 + rand() * 25
  const patternL = 50 + rand() * 10

  const ps = Math.min(100, Math.max(0, patternSat * saturation))
  let pl = Math.min(100, Math.max(0, patternL * lightness))
  const cs = Math.min(100, Math.max(0, 60 * saturation))
  const cl = Math.min(100, Math.max(0, 52 * lightness))
  const canL = lum(canHue, cs, cl)
  const sep = (l: number): number => lum(patternHue, ps, l) - canL
  // At full saturation the pattern's hue (120° off the can) separates it on its
  // own, so the brightness lift is only needed as saturation drops toward
  // grayscale, where hue vanishes and only lightness tells pattern from can.
  // Fade the lift to zero by saturation 0.6 (above that we trust the hue), and
  // scale it with the lightness knob so a dark palette gets a proportional,
  // non-glowing lift. lum rises monotonically with l, so lifting up always
  // separates better than dropping down — hence the single-direction bump.
  const lift = 35 * Math.min(1, lightness) * Math.max(0, 1 - saturation / 0.6)
  if (lift > 0 && sep(pl) < 0.15) pl = Math.min(100, pl + lift)

  // Seeded defaults (auto mode). A no-palette call uses these verbatim and
  // touches none of the palette RNGs below, so its output is byte-identical to
  // before the palette feature (the golden-hash test guards this).
  const defaultPatternColor = hsl(patternHue, ps, pl)
  // bgA doubles as the solid background, so solid and gradient stay consistent
  const defaultBgA = col(baseHue, 72, 74)
  const defaultBgB = col(baseHue + 25, 80, 55)
  const defaultCanColor = col(canHue, 60, 52)

  // Custom palette (when a pool is set): each layer picks from its own RNG so
  // the choices never disturb the main draw sequence above. Background gets two
  // distinct gradient stops; the pattern is chosen to contrast the can so it
  // stays visible.
  const bgRand = paletteRoleRand(seed, "background", bgPool)
  const canRand = paletteRoleRand(seed, "can", canPool)
  const patRand = paletteRoleRand(seed, "pattern", patPool)
  const bgFirst = pickColor(bgPool, bgRand, defaultBgA)
  const bgSecond = pickDifferentColor(bgPool, bgRand, bgFirst, defaultBgB)
  // lighter stop on top, darker on the bottom (only reorders when both stops
  // are hex picks — a seeded hsl() fallback keeps its order)
  const [bgA, bgB] = lighterFirst(bgFirst, bgSecond)
  const canColor = pickColor(canPool, canRand, defaultCanColor)
  const patternColor = pickContrastingColor(patPool, patRand, canColor, defaultPatternColor, 1.8)

  const bgFill = background === "gradient" ? `url(#${id}-bg)` : bgA
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sizeAttr}" height="${sizeAttr}" viewBox="${n(viewBox.x)} ${n(viewBox.y)} ${n(viewBox.size)} ${n(viewBox.size)}" role="img" ${
      title ? `aria-label="${esc(String(title))}"` : `aria-hidden="true"`
    }>` +
    `<defs>` +
    (background === "gradient"
      ? `<linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0.3" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/>` +
        `</linearGradient>`
      : "") +
    `<linearGradient id="${id}-hl">` +
    `<stop offset="0" stop-color="#000" stop-opacity=".18"/>` +
    `<stop offset=".18" stop-color="#fff" stop-opacity=".25"/>` +
    `<stop offset=".38" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset=".82" stop-color="#000" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity=".22"/>` +
    `</linearGradient>` +
    `<clipPath id="${id}-clip"><path d="${LABEL_D}"/></clipPath>` +
    `</defs>` +
    (background === "none"
      ? ""
      : `<rect x="${n(viewBox.x)}" y="${n(viewBox.y)}" width="${n(viewBox.size)}" height="${n(viewBox.size)}" fill="${bgFill}"/>`) +
    `<g transform="translate(${n(762 * (1 - CAN_SCALE))} ${n(762 * (1 - CAN_SCALE))}) scale(${CAN_SCALE}) translate(309 0)">` +
    `<path d="${SILHOUETTE_D}" fill="${canColor}"/>` +
    `<ellipse cx="458" cy="242" rx="267" ry="70" fill="${canColor}"/>` +
    `<ellipse cx="458" cy="237" rx="258" ry="55" fill="#ccd1d5"/>` +
    `<ellipse cx="325" cy="185" rx="125" ry="30" transform="rotate(20 325 185)" fill="#ccd1d5"/>` +
    `<ellipse cx="300" cy="208" rx="95" ry="26" transform="rotate(20 300 208)" fill="#ccd1d5"/>` +
    `<g clip-path="url(#${id}-clip)">` +
    pattern(patternType, rand, patternColor) +
    `</g>` +
    `<path d="${LABEL_D}" fill="url(#${id}-hl)"/>` +
    `<path d="${TEMPLATE_D}" fill="#000" fill-rule="evenodd"/>` +
    `</g>` +
    `</svg>`
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
  cache.set(key, svg)
  return svg
}

/** identican() output as a data: URI, ready to use as an <img> src. */
export function identicanDataUri(seed: string, options: IdenticanOptions = {}): string {
  return "data:image/svg+xml;utf8," + encodeURIComponent(identican(seed, options))
}

/** Theme options fixed for the lifetime of an {@link Identican} instance. */
export type IdenticanTheme = Pick<
  IdenticanOptions,
  "background" | "saturation" | "lightness" | "zoom" | "palette"
>

/** Per-generation options, passed on each call to an {@link Identican} instance. */
export type RenderOptions = Pick<IdenticanOptions, "size" | "title">

/** A single generation. Render lazily to whichever format you need. */
export interface IdenticanResult {
  /** SVG markup string — same as `identican(seed, { ...theme, ...renderOptions })`. */
  toSvg(): string
  /** `data:image/svg+xml` URI — same as `identicanDataUri(seed, { ...theme, ...renderOptions })`. */
  toDataURL(): string
}

// Callable-instance pattern: `new Identican(theme)` returns a function you call
// as `can(seed, renderOptions)`. The interface below adds the call signature to
// the `Identican` type (declaration merging with the class); the constructor
// returns the closure in place of `this`, so the instance IS that function.
export interface Identican {
  (seed: string, options?: RenderOptions): IdenticanResult
}

/**
 * Class API with the palette theme fixed at construction. The instance is
 * callable: `new Identican(theme)(seed, renderOptions)`.
 *
 * ```ts
 * const can = new Identican({ background: "solid", lightness: 0.5 })
 * can("user@example.com", { size: 48 }).toSvg()
 * can("user@example.com", { size: 48 }).toDataURL()
 * ```
 *
 * Theme (`background`/`hue`/`saturation`/`lightness`) is set once here; render
 * options (`size`/`title`) are passed per call. Output is identical to calling
 * `identican(seed, { ...theme, ...renderOptions })` directly.
 */
export class Identican {
  constructor(theme: IdenticanTheme = {}) {
    const call = (seed: string, options: RenderOptions = {}): IdenticanResult => {
      const merged: IdenticanOptions = { ...theme, ...options }
      return {
        toSvg: () => identican(seed, merged),
        toDataURL: () => identicanDataUri(seed, merged),
      }
    }
    // The constructor returns the closure, replacing the default `this`; the
    // `interface Identican` above types the result as callable.
    return call as unknown as Identican
  }
}

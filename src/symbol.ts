// Centered-symbol renderer shared by the symbol patterns (heart, club, star,
// ring, bolt, diamond, petal).
//
// The centered symbols are drawn as a single SVG <path>, so an affine transform
// can't bend them around the can. Instead we sample each path (curves, arcs,
// lines) into points, warp every point onto the cylinder surface, and re-emit a
// polyline. Flat at avatar sizes the sampling is imperceptible.
import { n } from "./util.js"
import { L, CX } from "./geometry.js"

const SHAPE_SIZE = 268 // centered symbol half-width
// Cylinder wrap for the centered symbol. SYMBOL_CURVE is the vertical bow: how
// far (template units) the symbol's left/right sides rise above its center, so
// horizontal features curve like paint on the can. SYMBOL_WRAP is a virtual
// cylinder radius for the horizontal foreshorten — larger = subtler side squeeze.
const SYMBOL_CURVE = 0
const SYMBOL_WRAP = 1000

// symbol shapes centered at the origin, half-width ~16 — scaled per use
const SHAPES = [
  // heart
  "M0 14 C-8 6 -16 0 -16 -6 C-16 -11 -13 -14 -8 -14 C-5 -14 -2 -12 0 -9 " +
    "C2 -12 5 -14 8 -14 C13 -14 16 -11 16 -6 C16 0 8 6 0 14 Z",
  // club — three lobes and a flared stem, single outline
  "M0 16 C-1.06 16 -2.03 15.74 -2.92 15.21 C-3.78 14.71 -4.47 14.03 -5 13.17 " +
    "C-5.5 12.28 -5.75 11.31 -5.75 10.25 C-5.75 8.92 -5.44 7.81 -4.83 6.92 " +
    "C-4.22 6.03 -3.28 4.99 -2 3.79 C-1.06 2.93 -0.58 2.11 -0.58 1.33 V0.58 H-1.33 " +
    "C-2.19 0.58 -3.38 1.44 -4.88 3.17 C-6.35 4.89 -8.14 5.75 -10.25 5.75 " +
    "C-11.31 5.75 -12.28 5.5 -13.17 5 C-14.03 4.47 -14.72 3.78 -15.25 2.92 " +
    "C-15.75 2.03 -16 1.06 -16 0 C-16 -1.06 -15.75 -2.01 -15.25 -2.88 " +
    "C-14.72 -3.76 -14.03 -4.46 -13.17 -4.96 C-12.28 -5.49 -11.31 -5.75 -10.25 -5.75 " +
    "C-8.17 -5.75 -6.39 -4.9 -4.92 -3.21 C-3.44 -1.51 -2.25 -0.67 -1.33 -0.67 H-0.58 V-1.33 " +
    "C-0.58 -2.11 -1.06 -2.93 -2 -3.79 L-2.96 -4.67 C-3.65 -5.31 -4.29 -6.07 -4.88 -6.96 " +
    "C-5.46 -7.88 -5.75 -8.97 -5.75 -10.25 C-5.75 -11.31 -5.5 -12.26 -5 -13.12 " +
    "C-4.47 -14.01 -3.78 -14.71 -2.92 -15.21 C-2.03 -15.74 -1.06 -16 0 -16 " +
    "C1.06 -16 2.01 -15.74 2.88 -15.21 C3.76 -14.68 4.46 -13.99 4.96 -13.12 " +
    "C5.49 -12.26 5.75 -11.31 5.75 -10.25 C5.75 -8.17 4.9 -6.39 3.21 -4.92 " +
    "C1.51 -3.44 0.67 -2.25 0.67 -1.33 V-0.67 H1.33 C2.28 -0.67 3.47 -1.51 4.92 -3.21 " +
    "C6.33 -4.9 8.11 -5.75 10.25 -5.75 C11.31 -5.75 12.26 -5.49 13.12 -4.96 " +
    "C14.01 -4.46 14.71 -3.78 15.21 -2.92 C15.74 -2.06 16 -1.08 16 0 " +
    "C16 1.06 15.74 2.03 15.21 2.92 C14.71 3.78 14.01 4.47 13.12 5 " +
    "C12.26 5.5 11.31 5.75 10.25 5.75 C8.94 5.75 7.82 5.43 6.88 4.79 " +
    "C5.96 4.15 4.93 3.22 3.79 2 C2.93 1.06 2.11 0.58 1.33 0.58 H0.67 V1.33 " +
    "C0.67 2.36 1.51 3.56 3.21 4.92 C4.9 6.28 5.75 8.06 5.75 10.25 " +
    "C5.75 11.31 5.49 12.28 4.96 13.17 C4.46 14.03 3.78 14.71 2.92 15.21 " +
    "C2.06 15.74 1.08 16 0 16 Z",
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
  // diamond — a four-pointed concave star (curved sides pinching to the axes)
  "M0 -16 C0.54 -7.4 7.4 -0.54 16 0 C7.4 0.54 0.54 7.4 0 16 " +
    "C-0.54 7.4 -7.4 0.54 -16 0 C-7.4 -0.54 -0.54 -7.4 0 -16 Z",
  // petal — four rounded petals meeting at the center, each with a punched
  // notch where it joins (even-odd fill)
  "M7.42 -10.47C7.62 -10.95 7.72 -11.47 7.72 -12C7.72 -12.79 7.49 -13.56 7.05 -14.22C6.61 -14.87 5.99 -15.39 5.26 -15.69C4.53 -15.99 3.73 -16.07 2.95 -15.92C2.18 -15.77 1.46 -15.39 0.9 -14.83L0 -13.99L-0.9 -14.83C-1.65 -15.58 -2.66 -16 -3.72 -16C-4.79 -16 -5.8 -15.58 -6.55 -14.83C-7.3 -14.08 -7.72 -13.06 -7.72 -12C-7.72 -10.94 -7.3 -9.92 -6.55 -9.17L-0.39 -2.92C-0.34 -2.87 -0.28 -2.83 -0.21 -2.8C-0.14 -2.77 -0.07 -2.76 0 -2.76C0.07 -2.76 0.15 -2.77 0.21 -2.8C0.28 -2.83 0.34 -2.87 0.39 -2.92L6.55 -9.17C6.92 -9.54 7.22 -9.98 7.42 -10.47Z" +
    "M-7.42 10.47C-7.62 10.95 -7.72 11.47 -7.72 12C-7.72 12.79 -7.49 13.56 -7.05 14.22C-6.61 14.87 -5.99 15.39 -5.26 15.69C-4.53 15.99 -3.73 16.07 -2.95 15.92C-2.18 15.77 -1.46 15.39 -0.9 14.83L0 13.99L0.9 14.83C1.65 15.58 2.66 16 3.72 16C4.79 16 5.8 15.58 6.55 14.83C7.3 14.08 7.72 13.06 7.72 12C7.72 10.94 7.3 9.92 6.55 9.17L0.39 2.92C0.34 2.87 0.28 2.83 0.21 2.8C0.14 2.77 0.07 2.76 0 2.76C-0.07 2.76 -0.15 2.77 -0.21 2.8C-0.28 2.83 -0.34 2.87 -0.39 2.92L-6.55 9.17C-6.92 9.54 -7.22 9.98 -7.42 10.47Z" +
    "M12 7.72C11.47 7.72 10.95 7.62 10.47 7.42C9.98 7.22 9.54 6.92 9.17 6.55L2.92 0.39C2.87 0.34 2.83 0.28 2.8 0.21C2.77 0.15 2.76 0.07 2.76 0C2.76 -0.07 2.77 -0.14 2.8 -0.21C2.83 -0.28 2.87 -0.34 2.92 -0.39L9.17 -6.55C9.92 -7.3 10.94 -7.72 12 -7.72C13.06 -7.72 14.08 -7.3 14.83 -6.55C15.58 -5.8 16 -4.79 16 -3.72C16 -2.66 15.58 -1.65 14.83 -0.9L13.99 0L14.83 0.9C15.39 1.46 15.77 2.18 15.92 2.95C16.07 3.73 15.99 4.53 15.69 5.26C15.39 5.99 14.87 6.61 14.22 7.05C13.56 7.49 12.79 7.72 12 7.72Z" +
    "M-10.47 -7.42C-10.95 -7.62 -11.47 -7.72 -12 -7.72C-12.79 -7.72 -13.56 -7.49 -14.22 -7.05C-14.87 -6.61 -15.39 -5.99 -15.69 -5.26C-15.99 -4.53 -16.07 -3.73 -15.92 -2.95C-15.77 -2.18 -15.39 -1.46 -14.83 -0.9L-13.99 0L-14.83 0.9C-15.58 1.65 -16 2.66 -16 3.72C-16 4.79 -15.58 5.8 -14.83 6.55C-14.08 7.3 -13.06 7.72 -12 7.72C-10.94 7.72 -9.92 7.3 -9.17 6.55L-2.92 0.39C-2.87 0.34 -2.83 0.28 -2.8 0.21C-2.77 0.14 -2.76 0.07 -2.76 0C-2.76 -0.07 -2.77 -0.15 -2.8 -0.21C-2.83 -0.28 -2.87 -0.34 -2.92 -0.39L-9.17 -6.55C-9.54 -6.92 -9.98 -7.22 -10.47 -7.42Z",
]

// --- symbol path flattening + cylinder warp -------------------------------
type Pt = [number, number]

function sampleCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, out: Pt[]): void {
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const mt = 1 - t
    const a = mt * mt * mt
    const b = 3 * mt * mt * t
    const c = 3 * mt * t * t
    const d = t * t * t
    out.push([
      a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    ])
  }
}

function sampleQuad(p0: Pt, p1: Pt, p2: Pt, out: Pt[]): void {
  const steps = 8
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const mt = 1 - t
    out.push([
      mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
      mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1],
    ])
  }
}

// SVG elliptical arc, endpoint → center parameterization (per the SVG spec),
// then sampled by angle. Our shapes only use circular arcs, but this is general.
function sampleArc(
  p0: Pt,
  rxIn: number,
  ryIn: number,
  phi: number,
  laf: number,
  sf: number,
  p: Pt,
  out: Pt[],
): void {
  let rx = Math.abs(rxIn)
  let ry = Math.abs(ryIn)
  const cosp = Math.cos(phi)
  const sinp = Math.sin(phi)
  const dx = (p0[0] - p[0]) / 2
  const dy = (p0[1] - p[1]) / 2
  const x1p = cosp * dx + sinp * dy
  const y1p = -sinp * dx + cosp * dy
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lam > 1) {
    const s = Math.sqrt(lam)
    rx *= s
    ry *= s
  }
  const rx2 = rx * rx
  const ry2 = ry * ry
  const denom = rx2 * y1p * y1p + ry2 * x1p * x1p
  const num = Math.max(0, rx2 * ry2 - denom)
  const co = (laf !== sf ? 1 : -1) * Math.sqrt(num / denom)
  const cxp = (co * rx * y1p) / ry
  const cyp = (-co * ry * x1p) / rx
  const cx = cosp * cxp - sinp * cyp + (p0[0] + p[0]) / 2
  const cy = sinp * cxp + cosp * cyp + (p0[1] + p[1]) / 2
  const ang = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy)
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)))
    if (ux * vy - uy * vx < 0) a = -a
    return a
  }
  const theta1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let dtheta = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
  if (!sf && dtheta > 0) dtheta -= 2 * Math.PI
  if (sf && dtheta < 0) dtheta += 2 * Math.PI
  const N = Math.max(6, Math.ceil(Math.abs(dtheta) / (Math.PI / 18)))
  for (let i = 1; i <= N; i++) {
    const th = theta1 + (dtheta * i) / N
    out.push([
      cosp * rx * Math.cos(th) - sinp * ry * Math.sin(th) + cx,
      sinp * rx * Math.cos(th) + cosp * ry * Math.sin(th) + cy,
    ])
  }
}

// Sample a path of absolute commands (M L H V C Q A Z — all the SHAPES use) into
// polyline subpaths in the shape's own unit space.
function flatten(d: string): Pt[][] {
  const subs: Pt[][] = []
  let pts: Pt[] = []
  let cur: Pt = [0, 0]
  let start: Pt = [0, 0]
  const re = /([MLHVCQAZ])([^MLHVCQAZ]*)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(d))) {
    const cmd = m[1].toUpperCase()
    const a = (m[2].match(/-?[0-9.]+(?:e-?[0-9]+)?/gi) ?? []).map(Number)
    switch (cmd) {
      case "M":
        if (pts.length) subs.push(pts)
        pts = []
        cur = [a[0], a[1]]
        start = cur
        pts.push(cur)
        for (let i = 2; i + 1 < a.length; i += 2) pts.push((cur = [a[i], a[i + 1]]))
        break
      case "L":
        for (let i = 0; i + 1 < a.length; i += 2) pts.push((cur = [a[i], a[i + 1]]))
        break
      case "H":
        for (const x of a) pts.push((cur = [x, cur[1]]))
        break
      case "V":
        for (const y of a) pts.push((cur = [cur[0], y]))
        break
      case "C":
        for (let i = 0; i + 5 < a.length; i += 6) {
          sampleCubic(cur, [a[i], a[i + 1]], [a[i + 2], a[i + 3]], [a[i + 4], a[i + 5]], pts)
          cur = [a[i + 4], a[i + 5]]
        }
        break
      case "Q":
        for (let i = 0; i + 3 < a.length; i += 4) {
          sampleQuad(cur, [a[i], a[i + 1]], [a[i + 2], a[i + 3]], pts)
          cur = [a[i + 2], a[i + 3]]
        }
        break
      case "A":
        for (let i = 0; i + 6 < a.length; i += 7) {
          const p: Pt = [a[i + 5], a[i + 6]]
          sampleArc(cur, a[i], a[i + 1], (a[i + 2] * Math.PI) / 180, a[i + 3], a[i + 4], p, pts)
          cur = p
        }
        break
      case "Z":
        if (pts.length) pts.push((cur = [start[0], start[1]]))
        break
    }
  }
  if (pts.length) subs.push(pts)
  return subs
}

// one symbol from SHAPES, drawn dead center on the label and gently wrapped onto
// the can. Each unit point is scaled by SHAPE_SIZE/16, then mapped onto the
// cylinder surface: its horizontal offset is read as an arc length around a
// virtual radius (SYMBOL_WRAP), so the sides foreshorten toward the edges, and
// its vertical position bows up at the sides (parabola × SYMBOL_CURVE) so
// horizontal features curve like paint on the can. The unit shapes are ~16
// half-width; evenodd keeps punched interiors (ring, petal) as holes.
export function symbol(shape: number, color: string): string {
  const cy = L.y + L.h / 2
  const k = SHAPE_SIZE / 16
  const warp = ([ux, uy]: Pt): Pt => {
    const sx = ux * k
    const f = sx / SHAPE_SIZE // -1..1 across the symbol's width
    return [CX + SYMBOL_WRAP * Math.sin(sx / SYMBOL_WRAP), cy + uy * k - SYMBOL_CURVE * f * f]
  }
  const d = flatten(SHAPES[shape])
    .map((sp) => "M" + sp.map((p) => `${n(warp(p)[0])} ${n(warp(p)[1])}`).join("L") + "Z")
    .join("")
  return `<path d="${d}" fill="${color}" fill-rule="evenodd"/>`
}

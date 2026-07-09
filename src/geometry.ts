// Shared can/label geometry used by every pattern.
//
// All geometry is in the template's coordinate space (soda-can.svg, 906×1524),
// centered in a 1524×1524 square viewBox via translate(309 0).
// L is the label region on the can's side where the pattern goes — flush with the
// template's drawn body lines: shoulder line at the top, bottom outline at the bottom.
import { n } from "./util.js"

export const L = { x: 126, y: 372, w: 648, h: 918 }
// Cylinder curvature: EDGE_RY matches the template's drawn rims (label clip edges).
export const RX = L.w / 2
export const EDGE_RY = 55
export const CX = L.x + RX

// PATTERN_CURVE is how hard the pattern wraps around the cylinder: the vertical
// droop (in units) at the can's center. EDGE_RY flattens it to the drawn rims;
// deliberately stronger so the wrap reads clearly.
export const PATTERN_CURVE = 72

// vertical droop of a point on the can surface at horizontal position x
export const droop = (x: number): number => {
  const t = (x - CX) / RX
  return PATTERN_CURVE * Math.sqrt(Math.max(0, 1 - t * t))
}

// horizontal band with elliptical top/bottom edges — a ring around the cylinder
export function ring(y: number, h: number, fill: string): string {
  const x2 = L.x + L.w
  return (
    `<path d="M ${L.x} ${n(y)} A ${RX} ${PATTERN_CURVE} 0 0 0 ${x2} ${n(y)} ` +
    `L ${x2} ${n(y + h)} A ${RX} ${PATTERN_CURVE} 0 0 1 ${L.x} ${n(y + h)} Z" fill="${fill}"/>`
  )
}

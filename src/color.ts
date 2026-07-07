// perceived brightness of an hsl color, 0–1 (rec. 709 weights on gamma-encoded
// rgb — fine for comparing two colors, not true relative luminance)
export function lum(h: number, s: number, l: number): number {
  h = ((h % 360) + 360) % 360
  s /= 100
  l /= 100
  const f = (nn: number) => {
    const k = (nn + h / 30) % 12
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return 0.2126 * f(0) + 0.7152 * f(8) + 0.0722 * f(4)
}

// True WCAG relative luminance / contrast ratio of hex strings — used only to
// keep custom-palette pattern colors visible against the chosen can color.
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

const parseHexColor = (color: string): { r: number; g: number; b: number } | null => {
  const hex = color.replace("#", "").trim()
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return null
  const v =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex
  return {
    r: parseInt(v.slice(0, 2), 16) / 255,
    g: parseInt(v.slice(2, 4), 16) / 255,
    b: parseInt(v.slice(4, 6), 16) / 255,
  }
}

const linearizeRgb = (v: number): number =>
  clamp01(v) <= 0.03928 ? clamp01(v) / 12.92 : ((clamp01(v) + 0.055) / 1.055) ** 2.4

function colorLuminance(color: string): number {
  const rgb = parseHexColor(color)
  if (!rgb) return 0.5 // non-hex (e.g. hsl fallback): neutral, never wins/loses contrast
  return 0.2126 * linearizeRgb(rgb.r) + 0.7152 * linearizeRgb(rgb.g) + 0.0722 * linearizeRgb(rgb.b)
}

export function contrastRatio(a: string, b: string): number {
  const l1 = colorLuminance(a)
  const l2 = colorLuminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

// Order two colors [lighter, darker] — but only when both are hex, so seeded
// `hsl()` stops (auto mode, single-color fallback) keep their original order.
export function lighterFirst(a: string, b: string): [string, string] {
  if (!parseHexColor(a) || !parseHexColor(b)) return [a, b]
  return colorLuminance(a) >= colorLuminance(b) ? [a, b] : [b, a]
}

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

const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1))
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60
  }
  return { h: ((h % 360) + 360) % 360, s: s * 100, l: l * 100 }
}

// Accept either an `hsl(H S% L%)` string (seeded stops) or a hex color (custom
// palette) and return its HSL components; null for anything else.
const parseColorHsl = (color: string): { h: number; s: number; l: number } | null => {
  const m = color.match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i)
  if (m) return { h: +m[1], s: +m[2], l: +m[3] }
  const rgb = parseHexColor(color)
  return rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null
}

// Derive the second gradient stop from the first instead of picking it
// independently: rotate the hue a third of the wheel (108° = 30% of 360) and
// darken to 70% lightness, so B always reads as a shaded relative of A — and is
// darker than A by construction, keeping the lighter stop on top.
const STOP_HUE_SHIFT = 70
const STOP_DARKEN = 0.7
const STOP_SATURATION = 0.7
export function deriveStop(color: string): string {
  const c = parseColorHsl(color)
  if (!c) return color // unknown format: no companion shade, reuse the color
  const h = Math.round((c.h + STOP_HUE_SHIFT) % 360)
  const s = Math.round(Math.max(0, c.s * STOP_SATURATION))
  const l = Math.round(Math.max(0, c.l * STOP_DARKEN))
  return `hsl(${h} ${s}% ${l}%)`
}

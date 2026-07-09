// Small formatting helpers shared across the renderer.

export const hsl = (h: number, s: number, l: number): string =>
  `hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(s)}% ${Math.round(l)}%)`

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

// Round to one decimal — keeps emitted coordinates compact and byte-stable.
export const n = (v: number): number => Math.round(v * 10) / 10

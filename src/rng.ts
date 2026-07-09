// Seeded, deterministic randomness. All variation in an identicon is drawn from
// mulberry32 in a fixed order — reordering or adding draws changes every
// identicon, which is an intentional breaking change (see CLAUDE.md).

export type Rand = () => number

// FNV-1a 32-bit
export function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// mulberry32 PRNG — all variation is drawn from this in a fixed order.
// Reordering or adding draws changes every identicon; that's an intentional breaking change.
export function mulberry32(seed: number): Rand {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Pattern registry + dispatch.
//
// Each pattern is its own function taking the main PRNG and the pattern color.
// Only `bands` and `diagonalStripes` draw from the PRNG (band count / stripe
// direction); the rest are fully determined by geometry and ignore it. The order
// of this table is the wire format — a pattern is selected by its index (see the
// `patternType` draw in ../index.ts), so reindexing changes every identicon.
import type { Rand } from "../rng.js"
import { stripes } from "./stripes.js"
import { chevrons } from "./chevrons.js"
import { waves } from "./waves.js"
import { polkadot } from "./polkadot.js"
import { bands } from "./bands.js"
import { diagonalStripes } from "./diagonal-stripes.js"
import { spiral } from "./spiral.js"
import { sunburst } from "./sunburst.js"
import { heart, club, star, ring, bolt, diamond, petal } from "./symbols.js"
import { diagonalSplit } from "./diagonal-split.js"
import { vee } from "./vee.js"
import { bullseye } from "./bullseye.js"
import { bigX } from "./big-x.js"
import { wavySplit } from "./wavy-split.js"

export type PatternFn = (rand: Rand, color: string) => string

// Indexed by patternType (0–19).
const PATTERNS: readonly PatternFn[] = [
  stripes, // 0
  chevrons, // 1
  waves, // 2
  polkadot, // 3
  bands, // 4
  diagonalStripes, // 5
  spiral, // 6
  sunburst, // 7
  heart, // 8
  club, // 9
  star, // 10
  ring, // 11
  bolt, // 12
  diamond, // 13
  petal, // 14
  diagonalSplit, // 15
  vee, // 16
  bullseye, // 17
  bigX, // 18
  wavySplit, // 19
]

export function pattern(type: number, rand: Rand, color: string): string {
  return (PATTERNS[type] ?? wavySplit)(rand, color)
}

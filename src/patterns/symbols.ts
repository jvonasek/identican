import type { Rand } from "../rng.js"
import { symbol } from "../symbol.js"

// Centered-symbol patterns — each draws a single symbol dead center on the label
// via the shared cylinder-warping renderer in ../symbol.ts. Nothing seeded.

export const heart = (_rand: Rand, color: string): string => symbol(0, color)
export const club = (_rand: Rand, color: string): string => symbol(1, color)
export const star = (_rand: Rand, color: string): string => symbol(2, color)
export const ring = (_rand: Rand, color: string): string => symbol(3, color)
export const bolt = (_rand: Rand, color: string): string => symbol(4, color)
export const diamond = (_rand: Rand, color: string): string => symbol(5, color)
export const petal = (_rand: Rand, color: string): string => symbol(6, color)

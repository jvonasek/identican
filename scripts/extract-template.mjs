// Regenerates src/template.ts from soda-can.svg (rounds coords to shrink output).
import { readFileSync, writeFileSync } from "node:fs"

const svg = readFileSync(new URL("../soda-can.svg", import.meta.url), "utf8")
const d = svg
  .match(/ d="([^"]+)"/)[1]
  .replace(/-?\d+\.\d+/g, (m) => String(Math.round(parseFloat(m))))
  .replace(/\s+/g, " ")
  .trim()

writeFileSync(
  new URL("../src/template.ts", import.meta.url),
  `// Generated from soda-can.svg by scripts/extract-template.mjs — do not edit by hand.
// Line-art outline of the can, drawn on top of the generated colors/pattern.
export const TEMPLATE_D =
  "${d}";
`,
)
console.log("wrote src/template.ts")

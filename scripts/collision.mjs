import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

// Bundle identican from source (same trick as demo.mjs) and count how many
// distinct random seeds collapse to the same SVG.
const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL("../src/index.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  write: false,
})
const tmp = join(mkdtempSync(join(tmpdir(), "identican-")), "lib.mjs")
writeFileSync(tmp, outputFiles[0].text)
const { identican } = await import(tmp)

const N = Number(process.argv[2] ?? 1_000_000)
const randomString = (len) =>
  Array.from({ length: len }, () => String.fromCharCode(33 + Math.floor(Math.random() * 94))).join(
    "",
  )

// Every SVG carries a per-seed `id` (ci<hash36>-<opts36>) in its defs and
// url(#...) refs, so two look-alike cans still differ byte-for-byte. Strip it
// to compare by appearance — a collision is two seeds that render the same picture.
const stripId = (svg) => svg.replace(/ci[0-9a-z]+-[0-9a-z]+/g, "")

const seeds = new Set() // distinct random seeds
const visual = new Set() // distinct appearances (SVG with the id stripped)
for (let i = 0; i < N; i++) {
  const seed = randomString(15)
  seeds.add(seed)
  visual.add(stripId(identican(seed)))
  if ((i + 1) % Math.trunc(N / (i < N / 10 ? 100 : 10)) === 0) {
    const c = seeds.size - visual.size
    console.log(`${c} collisions out of ${seeds.size} (${((c / seeds.size) * 100).toFixed(2)}%)`)
  }
}

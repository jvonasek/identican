import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

// Bundle the library and the benchmark helpers straight from source and inline
// them into the page (export footers stripped), the same way scripts/demo.mjs
// does. This makes benchmark.html self-contained — no `dist/` and no loose
// module imports — so it works over file:// and on GitHub Pages, where the
// original `../dist/index.js` / `./benchmark.js` imports would 404.
const bundle = async (entry) => {
  const { outputFiles } = await build({
    entryPoints: [fileURLToPath(new URL(entry, import.meta.url))],
    bundle: true,
    format: "esm",
    write: false,
  })
  return outputFiles[0].text.replace(/export\s*\{[^}]*\};?\s*$/, "")
}

const lib = await bundle("../src/index.ts")
const helpers = await bundle("../benchmark/benchmark.js")

const source = readFileSync(new URL("../benchmark/browser.html", import.meta.url), "utf8")
const page = source
  // Inject the bundles at the top of the module and drop the now-dead imports.
  // Keep `type="module"` so the script stays deferred — a plain script would
  // run mid-parse, before `#result` exists, and never update the result line.
  .replace('<script type="module">', `<script type="module">\n${lib}\n${helpers}`)
  .replace(/^\s*import \{ Identican \} from "\.\.\/dist\/index\.js"\n/m, "")
  .replace(/^\s*import \{ benchmark, randomString \} from "\.\/benchmark\.js"\n/m, "")

writeFileSync(new URL("../benchmark.html", import.meta.url), page)

console.log("wrote benchmark.html")

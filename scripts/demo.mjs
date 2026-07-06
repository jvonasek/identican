import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import { Eta } from "eta"

// Bundle the library straight from source (esbuild resolves the template
// import) so the demo doesn't depend on dist and works regardless of how
// `npm run build` minifies. One bundle serves two purposes:
//  - imported in Node to pre-render the gallery cells
//  - inlined into the page (export footer stripped) so the seed tester runs
//    in the browser over file://, where module imports are blocked
const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL("../src/index.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  write: false,
})
const code = outputFiles[0].text
const tmp = join(mkdtempSync(join(tmpdir(), "identican-")), "lib.mjs")
writeFileSync(tmp, code)
const { identican } = await import(tmp)
const lib = code.replace(/export\s*\{[^}]*\};?\s*$/, "")

const GALLERY_SIZE = 128

const cells = Array.from({ length: 64 }, (_, i) => ({
  seed: `can-${i + 1}`,
  svg: identican(`a${i + 1}`, { size: GALLERY_SIZE }),
}))

const eta = new Eta({ views: fileURLToPath(new URL("./templates", import.meta.url)) })

writeFileSync(
  new URL("../index.html", import.meta.url),
  eta.render("index", { cells, lib, gallerySize: GALLERY_SIZE }) + "\n",
)

console.log("wrote index.html")

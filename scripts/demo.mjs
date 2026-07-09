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
const { Identican } = await import(tmp)
const lib = code.replace(/export\s*\{[^}]*\};?\s*$/, "")

// demo themes bundle — inlined into the page (export stripped) so the `?theme=`
// switcher can read `THEMES` in the browser over file://
const themesBuild = await build({
  entryPoints: [fileURLToPath(new URL("./themes/index.mjs", import.meta.url))],
  bundle: true,
  format: "esm",
  write: false,
})
const themes = themesBuild.outputFiles[0].text.replace(/export\s*\{[^}]*\};?\s*$/, "")

const GALLERY_SIZE = 128

const can = new Identican()
const cells = Array.from({ length: 64 }, (_, i) => ({
  seed: `user-${i + 1}`,
  svg: can(`a${i + 1}`, { size: GALLERY_SIZE }).toSvg(),
}))

const eta = new Eta({ views: fileURLToPath(new URL("./templates", import.meta.url)) })

writeFileSync(
  new URL("../index.html", import.meta.url),
  eta.render("index", { cells, lib, themes, gallerySize: GALLERY_SIZE }) + "\n",
)

console.log("wrote index.html")

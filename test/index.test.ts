import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { identican, identicanDataUri, Identican } from "../dist/index.js"
import { lum } from "../src/color.ts"

test("same seed produces identical output", () => {
  assert.equal(identican("hello"), identican("hello"))
})

test("memoized result matches a fresh computation for the same options", () => {
  const opts = { size: 64, saturation: 0.8 }
  const first = identican("cachecheck", opts) // populates cache
  const second = identican("cachecheck", opts) // cache hit
  assert.equal(first, second)
})

test("cache key distinguishes options — different options are not aliased", () => {
  const a = identican("aliascheck", { size: 64 })
  const b = identican("aliascheck", { size: 65 })
  assert.notEqual(a, b) // would be equal if size were missing from the key
})

test("different seeds produce different output", () => {
  assert.notEqual(identican("hello"), identican("world"))
})

test("output is an svg with a viewBox", () => {
  const svg = identican("hello")
  assert.ok(svg.startsWith("<svg"))
  assert.ok(svg.endsWith("</svg>"))
  assert.ok(svg.includes('viewBox="0 0 1524 1524"'))
})

test("size option sets width/height, default is 128", () => {
  assert.ok(identican("hello").includes('width="128" height="128"'))
  assert.ok(identican("hello", { size: 64 }).includes('width="64" height="64"'))
})

test("non-numeric size cannot inject markup", () => {
  // @ts-expect-error — size is typed number; the point is hostile non-numeric input
  const svg = identican("hello", { size: '"><script>alert(1)</script>' })
  assert.ok(!svg.includes("<script"))
  assert.ok(svg.includes('width="128" height="128"'))
  // @ts-expect-error — numeric string is coerced at runtime; not a valid static type
  assert.ok(identican("hello", { size: "64" }).includes('width="64" height="64"'))
})

test("empty seed is valid", () => {
  assert.ok(identican("").startsWith("<svg"))
})

test("saturation/lightness options scale every color", () => {
  // saturation 0 → grayscale: every hsl() lands on 0% saturation
  const gray = identican("hello", { saturation: 0 })
  assert.ok(gray.includes("hsl("))
  assert.ok([...gray.matchAll(/hsl\(\d+ (\d+)%/g)].every((m) => m[1] === "0"))
  // defaults match explicit 1/1; non-defaults change the output
  assert.equal(identican("hello"), identican("hello", { saturation: 1, lightness: 1 }))
  assert.notEqual(identican("hello"), identican("hello", { lightness: 1.3 }))
})

test("base hue is quantized to a multiple of 18", () => {
  for (const seed of ["a", "hello", "world", "1", "identican", "xyz", "seed-42"]) {
    const svg = identican(seed)
    const m = svg.match(/hsl\((\d+) 72% 74%\)/) // bgA signature
    assert.ok(m, `no background color found for seed "${seed}"`)
    assert.equal(Number(m[1]) % 18, 0, `base hue not on the 20-hue wheel for "${seed}"`)
  }
})

test("can hue is a seeded soft-split complement of the base", () => {
  const allowed = new Set([150, 165, 195, 210])
  const seen = new Set()
  for (let i = 0; i < 50; i++) {
    const svg = identican("offset-seed-" + i)
    const b = svg.match(/hsl\((\d+) 72% 74%\)/) // bgA → baseHue
    const c = svg.match(/hsl\((\d+) 60% 52%\)/) // canColor → canHue
    assert.ok(b && c, `missing bg/can color for seed ${i}`)
    const offset = (((Number(c[1]) - Number(b[1])) % 360) + 360) % 360
    assert.ok(allowed.has(offset), `offset ${offset} not in [150,165,195,210] (seed ${i})`)
    seen.add(offset)
  }
  assert.ok(seen.size >= 2, `expected multiple offsets across 50 seeds, saw ${[...seen]}`)
})

test("pattern stays lighter than the can on a dark grayscale palette", () => {
  // gray + dark is the worst case: hue can't separate pattern from can,
  // so the brightness guard must fire and lift the pattern on every seed
  const l = (svg: string) => [...svg.matchAll(/hsl\(\d+ \d+% (\d+)%\)/g)].map((m) => +m[1])
  for (const seed of Array.from({ length: 20 }, (_, i) => `user-${i}`)) {
    const ls = l(identican(seed, { saturation: 0, lightness: 0.5, background: "none" }))
    const [can, pattern] = [ls[0], ls[ls.length - 1]]
    if (pattern === can) continue // plain pattern — only the can color is emitted
    assert.ok(pattern - can > 12, `${seed}: pattern ${pattern}% vs can ${can}%`)
  }
})

test("background option: gradient (default), solid, none", () => {
  assert.ok(identican("hello").includes('fill="url(#'))
  assert.ok(
    identican("hello", { background: "solid" }).includes(
      '<rect x="0" y="0" width="1524" height="1524" fill="hsl(',
    ),
  )
  assert.ok(!identican("hello", { background: "none" }).includes("<rect"))
})

test("def ids differ when theme options differ, so same-seed defs cannot collide", () => {
  const idOf = (svg: string) => svg.match(/clip-path="url\(#([^)]+)-clip\)"/)![1]
  assert.equal(idOf(identican("hello")), idOf(identican("hello")))
  assert.notEqual(idOf(identican("hello")), idOf(identican("hello", { lightness: 0.5 })))
  assert.notEqual(idOf(identican("hello")), idOf(identican("hello", { background: "solid" })))
})

test("pattern/can brightness separation holds across the lightness knob", () => {
  // grayscale is where the guard matters: hue can't separate pattern from can,
  // so the luminance lift must hold across every lightness (as saturation rises
  // the hue itself does the separating and the lift fades out — see the lift
  // formula, zero by saturation 0.6)
  for (const lightness of [0.5, 1, 1.3, 1.6]) {
    for (let i = 0; i < 200; i++) {
      const svg = identican(`user-${i}`, { saturation: 0, lightness, background: "none" })
      const colors = [...svg.matchAll(/hsl\((\d+) (\d+)% (\d+)%\)/g)].map(
        (m) => m.slice(1).map(Number) as [number, number, number],
      )
      const can = colors[0]
      const pattern = colors[colors.length - 1]
      if (pattern.join() === can.join()) continue // plain pattern — only the can color is emitted
      const diff = Math.abs(lum(...pattern) - lum(...can))
      assert.ok(diff >= 0.09, `user-${i} @ lightness ${lightness}: |lum diff| ${diff.toFixed(3)}`)
    }
  }
})

test("identicanDataUri wraps identican output as a data: URI", () => {
  const uri = identicanDataUri("hello", { size: 64 })
  assert.ok(uri.startsWith("data:image/svg+xml;utf8,"))
  assert.equal(
    decodeURIComponent(uri.slice("data:image/svg+xml;utf8,".length)),
    identican("hello", { size: 64 }),
  )
})

test("aria: hidden by default, labelled via title, label escaped", () => {
  assert.ok(identican("hello").includes('aria-hidden="true"'))
  const labelled = identican("hello", { title: "avatar for jane" })
  assert.ok(labelled.includes('aria-label="avatar for jane"'))
  assert.ok(!labelled.includes("aria-hidden"))
  const hostile = identican("hello", { title: '"><script>alert(1)</script>' })
  assert.ok(!hostile.includes("<script"))
  assert.ok(hostile.includes("&quot;&gt;&lt;script&gt;"))
})

test("zoom scales the viewBox with an auto vertical pan", () => {
  // no zoom → full frame
  assert.ok(identican("hello").includes('viewBox="0 0 1524 1524"'))
  // zoom 1.4 → size 1524/1.4 ≈ 1088.6, y pan -33%*(1.4-1)=-13.2%:
  // x=(0.5-0.5/1.4)*1524≈217.7, y=(0.5-0.5/1.4-0.132)*1524≈16.5
  assert.ok(identican("hello", { zoom: 1.4 }).includes('viewBox="217.7 16.5 1088.6 1088.6"'))
  // zoom <1 zooms out (larger viewBox), can stays centered (no y pan)
  assert.ok(identican("hello", { zoom: 0.5 }).includes('viewBox="-762 -762 3048 3048"'))
  // zoom is part of the cache key / id — different zoom, different output
  assert.notEqual(identican("hello", { zoom: 1.4 }), identican("hello"))
})

test("palette overrides the seeded colors verbatim", () => {
  const svg = identican("hello", {
    palette: { backgrounds: ["#0a0a0a"], cans: ["#e11d48"], patterns: ["#22d3ee"] },
  })
  // gradient background → first stop is the pick; with only one bg color the
  // second stop falls back to the seeded default so the two stops always differ
  assert.equal([...svg.matchAll(/stop-color="#0a0a0a"/g)].length, 1)
  // solid background → the pick is the rect fill
  const solid = identican("hello", {
    background: "solid",
    palette: { backgrounds: ["#0a0a0a"] },
  })
  assert.ok(solid.includes('fill="#0a0a0a"'))
  assert.ok(svg.includes('fill="#e11d48"')) // can silhouette
  // NOTE: patterns render via fill= OR stroke= depending on the seed's
  // patternType (stripes/waves/spiral are strokes) — match either, so this
  // test doesn't silently depend on what pattern "hello" happens to get
  assert.match(svg, /(fill|stroke)="#22d3ee"/)
})

test("gradient derives the second stop from the pool pick", () => {
  // stop A is a color from the pool; stop B is not a separate pool color but a
  // derived shade (an hsl() string), so the two stops always differ.
  const svg = identican("hello", {
    palette: { backgrounds: ["#0a0a0a", "#f0f0f0"] },
  })
  // bg stops close right after stop-color; the highlight gradient's stops carry
  // a stop-opacity, so this only captures the two background stops
  const stops = [...svg.matchAll(/stop-color="([^"]+)"\/>/gi)].map((m) => m[1])
  assert.equal(stops.length, 2)
  assert.ok(["#0a0a0a", "#f0f0f0"].includes(stops[0]), `top stop from pool: ${stops[0]}`)
  assert.match(stops[1], /^hsl\(/) // derived shade, not a raw pool color
  assert.notEqual(stops[0], stops[1]) // never a flat fill
})

test("gradient keeps the derived (darker) stop on the bottom", () => {
  // the derived stop B keeps 70% of A's lightness, so the bottom (offset 1) is
  // always darker than the top (offset 0) — lighter stop on top by construction
  for (const seed of ["a", "b", "c", "d", "e", "f"]) {
    const svg = identican(seed, { palette: { backgrounds: ["#eeeeee"] } })
    // bg stops close right after stop-color; the highlight gradient's stops carry
    // a stop-opacity, so this only captures the two background stops
    const stops = [...svg.matchAll(/stop-color="([^"]+)"\/>/gi)].map((m) => m[1])
    assert.equal(stops[0], "#eeeeee") // pool pick on top
    const l = Number(stops[1].match(/([\d.]+)%\)$/)![1]) // derived lightness
    assert.ok(l < 93, `derived stop should be darker than #eeeeee: ${stops[1]}`)
  }
})

test("background avoids a hue too similar to the can, but stays random otherwise", () => {
  // pool of two distinct, non-blending backgrounds against a red can (~348°):
  // random picking must use BOTH across seeds (variety is preserved)
  const a = "#22d3ee" // ~187° — near the can's complement
  const b = "#84cc16" // ~83° — well clear of the can's hue
  const bgOf = (svg: string) => svg.match(/fill="(#[0-9a-f]{6})"/i)?.[1]
  const picks = new Set(
    ["a", "b", "c", "d", "e", "f", "g", "h"].map((seed) =>
      bgOf(
        identican(seed, {
          background: "solid",
          palette: { cans: ["#e11d48"], backgrounds: [a, b] },
        }),
      ),
    ),
  )
  assert.ok(picks.has(a) && picks.has(b), `both bg colors should appear: ${[...picks]}`)

  // now add a bg that is near-analogous to the can (would blend): it must never
  // be chosen while non-blending options exist
  const same = "#f97316" // ~25° — same warm family as the can
  for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
    const svg = identican(seed, {
      background: "solid",
      palette: { cans: ["#e11d48"], backgrounds: [a, b, same] },
    })
    assert.ok(!svg.includes(`"${same}"`), `seed ${seed} must not pick blending bg ${same}`)
  }
})

test("pattern is picked to contrast the can, not just verbatim", () => {
  // one high-contrast + one near-invisible pattern color against the can:
  // the low-contrast one must never be chosen while a better option exists
  const bad = "#e11e48" // ~same luminance as the can
  const good = "#22d3ee"
  for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
    const svg = identican(seed, {
      palette: { cans: ["#e11d48"], patterns: [good, bad] },
    })
    assert.match(svg, new RegExp(`(fill|stroke)="${good}"`))
    assert.ok(!svg.includes(`"${bad}"`))
  }
})

test("palette leaves un-specified layers seeded", () => {
  // only cans provided → background/pattern still seeded hsl()
  const svg = identican("hello", { palette: { cans: ["#e11d48"] } })
  assert.ok(svg.includes('fill="#e11d48"'))
  assert.ok(svg.includes("hsl(")) // seeded layers remain
})

test("empty palette array is treated as not provided", () => {
  // must be byte-identical to no palette at all (no extra PRNG draw)
  assert.equal(identican("hello", { palette: { backgrounds: [] } }), identican("hello"))
})

test("no palette matches omitting the option entirely (draw order preserved)", () => {
  assert.equal(identican("hello", { palette: {} }), identican("hello"))
  assert.equal(identican("hello", { palette: undefined }), identican("hello"))
})

test("palette color strings cannot inject markup", () => {
  const svg = identican("hello", {
    palette: { cans: ['"><script>alert(1)</script>'] },
  })
  assert.ok(!svg.includes("<script"))
})

test("palette is part of the cache key and def id", () => {
  const a = identican("hello", { palette: { cans: ["#e11d48"] } })
  const b = identican("hello", { palette: { cans: ["#2563eb"] } })
  assert.notEqual(a, b)
  const idOf = (s: string) => s.match(/clip-path="url\(#([^)]+)-clip\)"/)![1]
  assert.notEqual(idOf(a), idOf(b))
})

test("palette pick is deterministic across seeds", () => {
  const opts = { palette: { cans: ["#111", "#222", "#333", "#444"] } }
  assert.equal(identican("seed-x", opts), identican("seed-x", opts))
})

test("Identican theme carries the palette", () => {
  // no `as const` here — it would make the arrays readonly, which doesn't
  // satisfy `cans?: string[]`. (npm test doesn't typecheck test files — tsc
  // only covers src/ — but the error would surface in any editor.)
  const theme = { palette: { cans: ["#e11d48"] } }
  const can = new Identican(theme)
  assert.equal(can("hello").toSvg(), identican("hello", { ...theme }))
})

// Golden output-format guard. The PRNG draw order IS the output format
// (CLAUDE.md): if this test fails, you have changed every existing identicon.
// That is sometimes intended (a deliberate visual change) — then update the
// hashes below from the failure message and treat the release as breaking.
// If you did NOT intend a visual change, your change reordered/added/removed
// a rand() draw or altered emitted markup: fix that instead.
const GOLDEN: [string, Parameters<typeof identican>[1], string][] = [
  ["hello", {}, "834fddfe0bcaea35640a29c692affba21d06e5d88e87179aca09f114d89f4afe"],
  ["", {}, "3ac3b8e654b15f95e5ed909c85509a9de78fe2dacb8d5c94e0ae252f910b7695"],
  ["user-0", {}, "e1adfac4fb8a51b5f88bda5d684936f426dcc6db2ac66f1d10dccb47619c2639"],
  [
    "user-1",
    { background: "solid" },
    "1bbbb1ad22be6f404368426299fcfae10839e321b9df348c917ebe978ee81b8e",
  ],
  [
    "user-2",
    { background: "none", saturation: 0.5, lightness: 1.3 },
    "ddc3d17249e6469c3a5f1d0fb2f8866255c3256622bf9320b7d13fbf523bcfcd",
  ],
  [
    "user@example.com",
    { size: 64 },
    "45f5c8d797bff6720ed5cd668d31852651cdef069dca977a0834cd101cf4026b",
  ],
  [
    "user-3",
    { palette: { backgrounds: ["#0a0a0a"], cans: ["#e11d48"], patterns: ["#22d3ee"] } },
    "9e9dc6bc262c241f1137d1ebbf9548c361df35dca91cb928e0ae7bd083b83296",
  ],
]

test("output format is frozen (golden hashes)", () => {
  for (const [seed, opts, expected] of GOLDEN) {
    const actual = createHash("sha256").update(identican(seed, opts)).digest("hex")
    assert.equal(
      actual,
      expected,
      `format changed for ${JSON.stringify([seed, opts])}; actual ${actual}`,
    )
  }
})

test("Identican instance is callable and returns toSvg/toDataURL", () => {
  const can = new Identican({ background: "solid" })
  const result = can("randomseed", { size: 48 })
  assert.equal(typeof result.toSvg, "function")
  assert.equal(typeof result.toDataURL, "function")
  assert.ok(result.toSvg().startsWith("<svg"))
  assert.ok(result.toDataURL().startsWith("data:image/svg+xml;utf8,"))
})

test("Identican forwards theme + render options to identican()", () => {
  const theme = { background: "solid", lightness: 0.5, saturation: 0.5 } as const
  const can = new Identican(theme)
  assert.equal(
    can("randomseed", { size: 48 }).toSvg(),
    identican("randomseed", { ...theme, size: 48 }),
  )
  assert.equal(
    can("randomseed", { size: 48 }).toDataURL(),
    identicanDataUri("randomseed", { ...theme, size: 48 }),
  )
})

test("Identican with no theme matches the plain function", () => {
  const can = new Identican()
  assert.equal(can("hello").toSvg(), identican("hello"))
  assert.equal(can("hello", { size: 64 }).toSvg(), identican("hello", { size: 64 }))
})

test("Identican theme is applied (solid background produces a rect fill)", () => {
  const svg = new Identican({ background: "solid" })("hello").toSvg()
  assert.ok(svg.includes('<rect x="0" y="0" width="1524" height="1524" fill="hsl('))
  assert.ok(!new Identican({ background: "none" })("hello").toSvg().includes("<rect"))
})

test("Identican render options override per call, theme stays fixed", () => {
  const can = new Identican({ lightness: 0.5 })
  assert.ok(can("hello", { size: 48 }).toSvg().includes('width="48" height="48"'))
  assert.ok(can("hello", { size: 32 }).toSvg().includes('width="32" height="32"'))
  // theme (lightness: 0.5) is applied on every call
  assert.equal(can("hello").toSvg(), identican("hello", { lightness: 0.5 }))
})

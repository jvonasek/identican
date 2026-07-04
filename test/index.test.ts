import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { identican, identicanDataUri } from "../dist/index.js"
import { lum } from "../src/color.ts"

test("same seed produces identical output", () => {
  assert.equal(identican("hello"), identican("hello"))
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

test("hue option rotates every color", () => {
  assert.equal(identican("hello"), identican("hello", { hue: 0 }))
  assert.equal(identican("hello"), identican("hello", { hue: 360 }))
  assert.notEqual(identican("hello"), identican("hello", { hue: 90 }))
  // rotation preserves saturation/lightness for bg/can — only hues move
  // (the pattern color may shift: its legibility guard re-runs on rotated hues)
  const sl = (svg: string) => [...svg.matchAll(/hsl\(\d+ (\d+% \d+%)\)/g)].map((m) => m[1])
  assert.deepEqual(
    sl(identican("hello", { hue: 90 })).slice(0, 3),
    sl(identican("hello")).slice(0, 3),
  )
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
      '<rect width="1524" height="1524" fill="hsl(',
    ),
  )
  assert.ok(!identican("hello", { background: "none" }).includes("<rect"))
})

test("def ids differ when theme options differ, so same-seed defs cannot collide", () => {
  const idOf = (svg: string) => svg.match(/clip-path="url\(#([^)]+)-clip\)"/)![1]
  assert.equal(idOf(identican("hello")), idOf(identican("hello")))
  assert.notEqual(idOf(identican("hello")), idOf(identican("hello", { hue: 90 })))
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

// Golden output-format guard. The PRNG draw order IS the output format
// (CLAUDE.md): if this test fails, you have changed every existing identicon.
// That is sometimes intended (a deliberate visual change) — then update the
// hashes below from the failure message and treat the release as breaking.
// If you did NOT intend a visual change, your change reordered/added/removed
// a rand() draw or altered emitted markup: fix that instead.
const GOLDEN: [string, Parameters<typeof identican>[1], string][] = [
  ["hello", {}, "af4275d53897437197a991e9a3b2220b96a9e9dfdabc2fe06860849230869f81"],
  ["", {}, "478cb8fa6eb232e74af6136771c03e4bbe8fac6b213050af25940395b81aa4a8"],
  ["user-0", {}, "f0bfc022f276025080c9efc55a4de648db68f853a91c5290473a348e327ecd44"],
  [
    "user-1",
    { background: "solid" },
    "d0b05ae9c4127f8ac6aa86dc420fe092757a9c5dc4e0dfe0278c9e80c896f13e",
  ],
  [
    "user-2",
    { background: "none", hue: 90, saturation: 0.5, lightness: 1.3 },
    "a87da916ccab1cf6955a952b28b3b87d03aa4facf63ba988921a0e7d3d1955a5",
  ],
  [
    "user@example.com",
    { size: 64 },
    "9ed37d8d96882d1234cd6bfe854e84dc9487142bacb29f51a8397da3ebb879e8",
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

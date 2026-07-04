import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

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

const cells = Array.from(
  { length: 64 },
  (_, i) =>
    `<div class="aspect-square overflow-hidden rounded-xl" data-seed="can-${i + 1}">${identican(`a${i + 1}`, { size: GALLERY_SIZE })}</div>`,
).join("\n")

writeFileSync(
  new URL("../index.html", import.meta.url),
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Identican by jvonasek</title>
  <meta name="description" content="Deterministic soda-can identicons. Give it any string, get back a unique, colorful soda can">
  <script>
    (function () {
      const key = "identican-theme";
      const theme = localStorage.getItem(key) || "system";
      const dark =
        theme === "dark" ||
        (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    })();
  </script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { darkMode: "class" };</script>
</head>
<body class="min-h-screen bg-zinc-100 text-zinc-900 antialiased dark:bg-zinc-900 dark:text-zinc-100">
  <div class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
    <div class="mb-12 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-4xl font-bold tracking-tight sm:text-4xl">Identican</h1>
        <p class="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">Deterministic soda-can identicons. Give it any string, get back a unique soda can as an SVG.</p>
      </div>
      <div
        id="theme-switcher"
        class="flex shrink-0 rounded-lg border border-zinc-300 bg-zinc-200/60 p-0.5 text-xs font-medium dark:border-zinc-600 dark:bg-zinc-800"
        role="group"
        aria-label="Theme"
      >
        <button type="button" data-theme="system" class="theme-btn rounded-md px-2.5 py-1 text-zinc-600 dark:text-zinc-400">System</button>
        <button type="button" data-theme="light" class="theme-btn rounded-md px-2.5 py-1 text-zinc-600 dark:text-zinc-400">Light</button>
        <button type="button" data-theme="dark" class="theme-btn rounded-md px-2.5 py-1 text-zinc-600 dark:text-zinc-400">Dark</button>
      </div>
    </div>

    <header class="mb-12">
      <h2 class="text-2xl font-semibold tracking-tight">Try it</h2>
      <p class="mt-2 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">Type any seed to preview identicons at multiple sizes.</p>
      <div class="mt-6 grid grid-cols-12 gap-x-8 gap-y-6">
        <div class="col-span-12 sm:col-span-8">
          <label for="seed" class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Seed</label>
          <input
            id="seed"
            type="text"
            placeholder="type any seed"
            value="Hello"
            class="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 font-mono text-base shadow-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-600"
          >
        </div>
        <div class="col-span-12 sm:col-span-4">
          <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Background</p>
          <div
            id="bg-switcher"
            class="mt-1.5 inline-flex rounded-lg border border-zinc-300 bg-zinc-200/60 p-0.5 text-xs font-medium dark:border-zinc-600 dark:bg-zinc-800"
            role="group"
            aria-label="Background"
          >
            <button type="button" data-bg="gradient" class="bg-btn rounded-md px-2.5 py-1 text-zinc-600 dark:text-zinc-400">Gradient</button>
            <button type="button" data-bg="solid" class="bg-btn rounded-md px-2.5 py-1 text-zinc-600 dark:text-zinc-400">Solid</button>
            <button type="button" data-bg="none" class="bg-btn rounded-md px-2.5 py-1 text-zinc-600 dark:text-zinc-400">None</button>
          </div>
        </div>
        <div id="preview" class="col-span-12 flex flex-nowrap items-end gap-5 overflow-x-auto pb-1 sm:col-span-8 sm:flex-wrap sm:overflow-visible"></div>
        <div class="col-span-12 space-y-4 sm:col-span-4">
          <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Hue <span id="hue-val" class="font-mono text-zinc-500 dark:text-zinc-400">0&deg;</span>
            <input id="hue" type="range" min="0" max="360" step="5" value="0" class="mt-1.5 block w-full accent-zinc-600 dark:accent-zinc-400">
          </label>
          <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Saturation <span id="sat-val" class="font-mono text-zinc-500 dark:text-zinc-400">1.00</span>
            <input id="sat" type="range" min="0" max="2" step="0.05" value="1" class="mt-1.5 block w-full accent-zinc-600 dark:accent-zinc-400">
          </label>
          <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Lightness <span id="light-val" class="font-mono text-zinc-500 dark:text-zinc-400">1.00</span>
            <input id="light" type="range" min="0.4" max="1.6" step="0.05" value="1" class="mt-1.5 block w-full accent-zinc-600 dark:accent-zinc-400">
          </label>
        </div>
      </div>
    </header>

    <hr class="border-zinc-200 dark:border-zinc-700">

    <section class="mt-12">
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-2xl font-semibold tracking-tight">Gallery</h2>
        <button type="button" id="randomize" class="shrink-0 rounded-lg border border-zinc-300 bg-zinc-200/60 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">Randomize</button>
      </div>
      <main class="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8 [&_svg]:block [&_svg]:size-full">
${cells}
      </main>
    </section>
  </div>
<script>
${lib}
const themeKey = "identican-theme";
const themeButtons = document.querySelectorAll(".theme-btn");

const applyTheme = (theme) => {
  const dark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  themeButtons.forEach((btn) => {
    const active = btn.dataset.theme === theme;
    btn.classList.toggle("bg-white", active);
    btn.classList.toggle("text-zinc-900", active);
    btn.classList.toggle("shadow-sm", active);
    btn.classList.toggle("dark:bg-zinc-700", active);
    btn.classList.toggle("dark:text-zinc-100", active);
    btn.setAttribute("aria-pressed", active);
  });
};

const setTheme = (theme) => {
  localStorage.setItem(themeKey, theme);
  applyTheme(theme);
};

themeButtons.forEach((btn) =>
  btn.addEventListener("click", () => setTheme(btn.dataset.theme))
);

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if ((localStorage.getItem(themeKey) || "system") === "system") applyTheme("system");
});

setTheme(localStorage.getItem(themeKey) || "system");

const sizes = [128, 96, 80, 64, 48, 32];
const bgButtons = document.querySelectorAll(".bg-btn");
let bg = "gradient";
const render = () => {
  const opts = { background: bg, hue: +hue.value, saturation: +sat.value, lightness: +light.value };
  document.getElementById("hue-val").textContent = hue.value + "\\u00b0";
  document.getElementById("sat-val").textContent = (+sat.value).toFixed(2);
  document.getElementById("light-val").textContent = (+light.value).toFixed(2);
  document.getElementById("preview").innerHTML = sizes
    .map((s) => \`<figure class="shrink-0 text-center">
      <div class="overflow-hidden shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-700/70" style="border-radius:\${Math.min(12, s / 8)}px">\${identican(seed.value, { ...opts, size: s })}</div>
      <figcaption class="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">\${s}px</figcaption>
    </figure>\`)
    .join("");
  document.querySelectorAll("[data-seed]").forEach((cell) => {
    cell.innerHTML = identican(cell.dataset.seed, { ...opts, size: ${GALLERY_SIZE} });
  });
};
const setBg = (value) => {
  bg = value;
  bgButtons.forEach((btn) => {
    const active = btn.dataset.bg === value;
    btn.classList.toggle("bg-white", active);
    btn.classList.toggle("text-zinc-900", active);
    btn.classList.toggle("shadow-sm", active);
    btn.classList.toggle("dark:bg-zinc-700", active);
    btn.classList.toggle("dark:text-zinc-100", active);
    btn.setAttribute("aria-pressed", active);
  });
  render();
};
bgButtons.forEach((btn) => btn.addEventListener("click", () => setBg(btn.dataset.bg)));
document.getElementById("randomize").addEventListener("click", () => {
  document.querySelectorAll("[data-seed]").forEach((cell) => {
    cell.dataset.seed = Math.random().toString(36).slice(2);
  });
  render();
});
seed.addEventListener("input", render);
hue.addEventListener("input", render);
sat.addEventListener("input", render);
light.addEventListener("input", render);
setBg("gradient");
</script>
</body>
</html>
`,
)

console.log("wrote index.html")

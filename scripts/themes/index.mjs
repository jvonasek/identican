import { getHydrationIdenticanPalette } from "./hydration.mjs"

// Demo themes, keyed by the `?theme=` query param. `options(resolvedTheme)`
// returns the IdenticanTheme merged into the constructor; resolvedTheme is the
// demo's active "light"/"dark" so a theme can swap palettes with the page.
export const THEMES = {
  hydration: {
    options: (resolvedTheme) => ({ palette: getHydrationIdenticanPalette(resolvedTheme) }),
  },
}

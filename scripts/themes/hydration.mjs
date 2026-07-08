const HYDRATION_IDENTICAN_CAN_COLORS = [
  "#E53E76",
  "#CC1775",
  "#DE394D",
  "#53A4F3",
  "#043875",
  "#36154B",
  "#2B1D3C",
  "#B3CF92",
]
const HYDRATION_IDENTICAN_PATTERN_COLORS = [
  "#240E32",
  "#111A15",
  "#98AFFF",
  "#BFFF98",
  "#F9AFCA",
  "#AAEEFC",
  "#E53E76",
  "#DFB1F3",
]
export const HYDRATION_LIGHT_IDENTICAN_PALETTE = {
  backgrounds: ["#ffdeec", "#fab6cf", "#dfb1f3", "#e7ece1", "#aaeefc", "#b3d7fa", "#a1b4f7"],
  cans: HYDRATION_IDENTICAN_CAN_COLORS,
  patterns: HYDRATION_IDENTICAN_PATTERN_COLORS,
}
export const HYDRATION_DARK_IDENTICAN_PALETTE = {
  backgrounds: ["#6b0054", "#560641", "#3c164b", "#221D36", "#033e4a", "#043267", "#11256f"],
  cans: HYDRATION_IDENTICAN_CAN_COLORS,
  patterns: HYDRATION_IDENTICAN_PATTERN_COLORS,
}
export const getHydrationIdenticanPalette = (theme) =>
  theme === "dark" ? HYDRATION_DARK_IDENTICAN_PALETTE : HYDRATION_LIGHT_IDENTICAN_PALETTE

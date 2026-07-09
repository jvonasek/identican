// Can-artwork geometry: the silhouette painted under the line art, and the label
// region used both to clip the pattern and to paint the highlight.

// Can size relative to the canvas — scaled about the canvas center (762, 762)
export const CAN_SCALE = 0.9

// Approximate silhouette of the template can, kept just inside its black outline;
// everything painted on it is covered by the line art on top. The shoulder flare
// is nearly straight in the artwork, so straight segments hug it tighter than a
// curve; the lid-ring area above is filled by a separate can-color ellipse.
export const SILHOUETTE_D =
  "M 119 372 L 120 1150 L 127 1252 A 325 143 0 0 0 777 1252 L 784 1150 L 784 372 " +
  "L 784 366 L 722 278 L 700 260 Q 458 196 197 258 L 117 356 Z"

// The label's top edge is the can's exact top/body divider curve, traced from
// soda-can.svg (same template space as everything else). The divider is an
// asymmetric curve that dips ~60px at the center — an ellipse can't match it, so
// clipping to an arc left a can-color sliver (or overshoot) against the black
// divider line. Tracing the real curve makes every pattern clip flush to it.
// Regenerate alongside the artwork if soda-can.svg changes (like SILHOUETTE_D).
const DIVIDER_TOP =
  "M 126 375.438 L 142.603 385.436 " +
  "C 173.711 404.168 238.442 420.693 315 429.445 " +
  "C 358.87 434.461 493.156 434.477 543 429.472 " +
  "C 592.165 424.535 643.995 415.88 681.829 406.29 " +
  "C 715.094 397.858 754.432 383.587 763.668 376.602 " +
  "C 766.875 374.176 770.513 372.148 771.75 372.095"
// The bottom edge is the can's exact body/foot divider, traced from soda-can.svg
// (right→left). Its end anchors are pushed out to the full label width (774 / 126)
// so the clip's sides stay vertical — the raw traced corners (x 768 / 135) sit
// inside the body, which would expose can color along the sides. An ellipse arc
// here spilled the pattern onto the foot and past the outline at the corners.
const DIVIDER_BOTTOM =
  "L 774 1246.712 " +
  "C 751.383 1284.006 672.87 1315.832 556.5 1332.576 " +
  "C 515.791 1338.434 391.792 1337.512 345 1331.005 " +
  "C 296.473 1324.256 244.599 1312.6 214.908 1301.773 " +
  "C 167.876 1284.622 135.488 1259.76 126 1240.5"
// label region (also the pattern clip): top and bottom follow the can's real
// divider curves; the sides are the implied vertical edges (right L, left Z)
export const LABEL_D = DIVIDER_TOP + " " + DIVIDER_BOTTOM + " Z"

/**
 * The accent the native reader paints its chrome with. What it reaches depends
 * on the iPadOS version, and this is worth knowing before expecting much:
 * everything drawn from `tintColor` follows it (the page grid's current-page
 * ring and number), but on **iPadOS 26 the bar buttons are monochrome glass and
 * ignore the tint entirely** — measured on the simulator, the bar has no
 * coloured pixel with or without this. On iPadOS 16–18, where bar glyphs still
 * take the tint, it reaches them too. Everything else stays Apple's:
 * `PKToolPicker`, the share sheet and the paper have no styling API, and the ink
 * would be wrong on anything but white paper.
 *
 * Two hexes because the theme has two: `--color-accent` in `src/index.css`,
 * light and dark. iPadOS picks per appearance (`PdfInkTint.dynamic`), which the
 * app cannot do with one colour — the bar behind it is white in one and
 * near-black in the other.
 *
 * Deliberately not the lime. #79be15 on a white bar is 2.29:1 — measured in
 * `src/index.css`, where the same finding moved `--color-primary-content` to
 * ink — and a bar button the student has to find and tap owes 3:1 (WCAG 1.4.11).
 * The navy clears 7.9:1 and the blue 4.6:1 on their own bars.
 *
 * Swap these two hexes and the whole reader follows; nothing else names a colour.
 */
export interface PdfInkTintHexes {
  light: string;
  dark: string;
}

export const PDF_INK_TINT: PdfInkTintHexes = { light: '#00548f', dark: '#3b82f6' };

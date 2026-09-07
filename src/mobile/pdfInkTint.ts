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
 * MENDELU green, one hex per appearance because no single one works on both
 * bars. The dark bar gets the brand lime itself, #79be15, which clears 7.5:1 on
 * it. The light bar cannot: the lime on white is 2.29:1 — measured in
 * `src/index.css`, where the same finding moved `--color-primary-content` to ink
 * — against the 3:1 a control the student has to find and tap owes (WCAG
 * 1.4.11). So light gets the same hue darkened, #4a7a0d, at 5.2:1. Both read as
 * the brand green; only one of them is the brand hex.
 *
 * Swap these two hexes and the whole reader follows; nothing else names a colour.
 */
export interface PdfInkTintHexes {
  light: string;
  dark: string;
}

export const PDF_INK_TINT: PdfInkTintHexes = { light: '#4a7a0d', dark: '#79be15' };

/**
 * DOM Parsing Utilities
 * 
 * Shared helpers for all MENDELU HTML parsers.
 * These utilities reduce boilerplate and ensure consistent null handling.
 */

/**
 * Safely extract text content from an element.
 * Returns trimmed text or fallback if element is null.
 */
export const safeText = (el: Element | null, fallback = ''): string =>
  el?.textContent?.trim() ?? fallback;

/**
 * Safely extract an attribute from an element.
 * Returns attribute value or fallback if element is null or attr missing.
 */
export const safeAttr = (el: Element | null, attr: string, fallback = ''): string =>
  el?.getAttribute(attr) ?? fallback;

/**
 * Parse HTML string into a Document.
 */
export const parseHtml = (html: string): Document =>
  new DOMParser().parseFromString(html, 'text/html');

/**
 * Extract ID from a link containing "id=NUMBER" pattern.
 * Common in MENDELU links like "clovek.pl?id=12345".
 */
export const extractIdFromLink = (link: Element | null): string => {
  const href = safeAttr(link, 'href');
  const match = href.match(/id=(\d+)/);
  return match?.[1] ?? '';
};

/**
 * Extract termin ID from a link containing "termin=NUMBER" pattern.
 */
export const extractTerminFromLink = (link: Element | null): string => {
  const href = safeAttr(link, 'href');
  const match = href.match(/termin=(\d+)/);
  return match?.[1] ?? '';
};

/**
 * Find the column index containing a date pattern (DD.MM.YYYY).
 * Returns -1 if not found.
 */
export const findDateColumnIndex = (cols: NodeListOf<Element>): number => {
  for (let i = 0; i < cols.length; i++) {
    if (cols[i].textContent?.match(/\d{2}\.\d{2}\.\d{4}/)) {
      return i;
    }
  }
  return -1;
};

/**
 * Parse a Czech date string to date and time parts.
 * Input: "01.12.2024 14:00"
 * Output: { date: "01.12.2024", time: "14:00" }
 */
export const parseDateTimeString = (dateStr: string): { date: string; time: string } => {
  const [datePart, timePart] = dateStr.split(' ');
  return { date: datePart || '', time: timePart || '' };
};

/**
 * Parse capacity string to current and max values.
 * Input: "18/20"
 * Output: { current: 18, max: 20, isFull: false }
 */
export const parseCapacity = (capacityStr: string): { current: number; max: number; isFull: boolean } => {
  const [currentStr, maxStr] = capacityStr.split('/');
  const current = parseInt(currentStr, 10) || 0;
  const max = parseInt(maxStr, 10) || 0;
  return { current, max, isFull: current >= max };
};

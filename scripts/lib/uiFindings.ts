/**
 * Turns a raw DOM probe (see `scripts/shot.ts`) into a list of layout and
 * legibility defects. Pure and node-testable on purpose: every geometry bug in
 * the ExamsScreen rebuild was caught by measurement, never by reading code, so
 * the judging half of that measurement is kept where it can be unit-tested.
 *
 * The browser side only reads numbers — rects, resolved RGBA, font metrics.
 * All thresholds and decisions live here.
 */

import { compositeOver, contrastRatio, OPAQUE_WHITE, type Rgba } from './contrast';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProbeElement {
  /**
   * Inside a third-party widget that positions its own internals outside its
   * box and clips them — Leaflet's tile pane. Such an element sitting past the
   * viewport is by design. Scoped to named widgets on purpose: excusing
   * everything with a clipping ancestor excuses most of the app.
   */
  insideInnerClip?: boolean;
  /** Stable index within the probe, used to express ancestry. */
  idx: number;
  /** Indices of this element's ancestors, nearest-first. */
  ancestors: number[];
  sel: string;
  text: string;
  rect: Rect;
  /** Own resolved background-color, or null when unresolvable. */
  bg: Rgba | null;
  /** Ancestors' backgrounds, nearest-first, excluding this element's own. */
  bgChain: Rgba[];
  color: Rgba | null;
  fontSize: number;
  fontWeight: number;
  hasDirectText: boolean;
}

export interface ProbeResult {
  width: number;
  height: number;
  docScrollWidth: number;
  docClientWidth: number;
  /** The page's own backdrop, terminating every ancestor chain. Assuming white
   *  here would score light text on an unpainted container as illegible. */
  rootBg?: Rgba | null;
  elements: ProbeElement[];
}

export type FindingKind =
  'overflow' | 'overflow-element' | 'contrast-surface' | 'contrast-text' | 'collision';

export interface Finding {
  kind: FindingKind;
  sel: string;
  detail: string;
  severity: 'error' | 'warn';
}

/** Below this ratio two adjacent surfaces are indistinguishable on a real screen. */
export const MIN_SURFACE_RATIO = 1.05;
/** WCAG AA for body text, and for large text. */
export const MIN_TEXT_RATIO = 4.5;
export const MIN_LARGE_TEXT_RATIO = 3;
/** Sub-pixel slack — browsers routinely report fractional scroll widths. */
const PX_SLACK = 1;
/** Overlap beyond this share of the smaller box is a real collision, not a nudge. */
const COLLISION_OVERLAP_SHARE = 0.4;
/** Cap the per-run report so a systemic issue can't produce thousands of lines. */
const MAX_PER_KIND = 12;

const area = (r: Rect) => Math.max(0, r.w) * Math.max(0, r.h);

function isOpaqueEnough(c: Rgba | null): c is Rgba {
  return c != null && c.a > 0.01;
}

/**
 * Flatten an element's backdrop the way the browser paints it: every ancestor
 * layer composited in turn, outermost first, over the page backdrop.
 *
 * Taking only the nearest painted ancestor and dropping it straight onto the
 * page backdrop skips every translucent layer between them, so the judged
 * colour is not the pixel that ends up on screen. The probe truncates the chain
 * at the first fully opaque ancestor, so this stays short.
 *
 * Returns null when nothing paints at all — no backdrop means no claim.
 */
function backdropOf(e: ProbeElement, root: Rgba | null | undefined): Rgba | null {
  const painted = e.bgChain.filter(isOpaqueEnough);
  if (painted.length === 0) return isOpaqueEnough(root) ? root : null;

  let acc: Rgba = isOpaqueEnough(root) ? root : OPAQUE_WHITE;
  // bgChain is nearest-first; paint from the far end inward.
  for (let i = painted.length - 1; i >= 0; i--) acc = compositeOver(painted[i]!, acc);
  return acc;
}

function sameColor(a: Rgba, b: Rgba): boolean {
  return (
    Math.round(a.r) === Math.round(b.r) &&
    Math.round(a.g) === Math.round(b.g) &&
    Math.round(a.b) === Math.round(b.b) &&
    Math.abs(a.a - b.a) < 0.01
  );
}

/**
 * The surface text is actually drawn on: the element's own background when it
 * paints one (a chip, a badge, a button), otherwise the nearest painted
 * ancestor. Using the ancestor for an element that paints its own background
 * measures the wrong pair and wildly under-reports.
 */
function textBackdropOf(e: ProbeElement, root: Rgba | null | undefined): Rgba | null {
  const ancestor = backdropOf(e, root);
  if (!isOpaqueEnough(e.bg)) return ancestor;
  return compositeOver(e.bg, ancestor ?? OPAQUE_WHITE);
}

function isLargeText(e: ProbeElement): boolean {
  return e.fontSize >= 24 || (e.fontSize >= 18.66 && e.fontWeight >= 700);
}

function overlapShare(a: Rect, b: Rect): number {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (ox <= 0 || oy <= 0) return 0;
  const smaller = Math.min(area(a), area(b));
  return smaller === 0 ? 0 : (ox * oy) / smaller;
}

function overflowFindings(p: ProbeResult): Finding[] {
  const out: Finding[] = [];
  const over = p.docScrollWidth - p.docClientWidth;
  if (over > PX_SLACK) {
    out.push({
      kind: 'overflow',
      sel: 'document',
      detail: `page scrolls ${Math.round(over)}px horizontally at ${p.width}px wide`,
      severity: 'error',
    });
  }

  // Per-element, and deliberately NOT nested inside the document-scroll check
  // above. reIS clips at #root, so the document never scrolls horizontally —
  // which meant this whole rule could never fire in this app, in shot.ts or in
  // the CI gate. Verified by injecting a 2000px-wide element: docScrollWidth
  // stayed equal to clientWidth and nothing was reported.
  //
  // Clipped is not better than scrolled. It is worse: the content is simply
  // unreachable, with no scrollbar to hint that anything is missing.
  //
  // Elements parked entirely off-canvas (a closed drawer at translateX(100%))
  // do not reach here — the probe's own elementFromPoint occlusion test drops
  // anything whose centre is not the topmost element at that point.
  for (const e of p.elements) {
    // Leaflet lays its tiles beyond the map pane on purpose and clips them;
    // measuring those produced 26 failures, enough to fail every PR.
    if (e.insideInnerClip) continue;
    // BOTH edges. Measuring only the right one let an element at x:-20 sit
    // half off the left of the screen and report nothing — clipped by #root
    // and just as unreachable as one running off the right.
    const pastRight = e.rect.x + e.rect.w - p.width;
    const pastLeft = -e.rect.x;
    const past = Math.max(pastLeft, pastRight);
    if (past > PX_SLACK && area(e.rect) > 0) {
      out.push({
        kind: 'overflow-element',
        sel: e.sel,
        // Named per edge rather than as one number: "extends 20px past the
        // viewport" would be actively misleading for something hanging off
        // the left, and the fix differs by side.
        detail:
          pastLeft > pastRight
            ? `starts ${Math.round(pastLeft)}px left of the ${p.width}px viewport`
            : `extends ${Math.round(pastRight)}px past the ${p.width}px viewport`,
        severity: 'error',
      });
    }
  }
  return out;
}

function surfaceFindings(p: ProbeResult): Finding[] {
  const out: Finding[] = [];
  for (const e of p.elements) {
    if (!isOpaqueEnough(e.bg) || area(e.rect) < 4) continue;
    const backdrop = backdropOf(e, p.rootBg);
    if (!backdrop) continue;
    // An element that reuses its backdrop's exact colour is composition, not a
    // mistake. Only a *different* colour that fails to read is a defect.
    if (sameColor(e.bg, backdrop)) continue;
    const painted = compositeOver(e.bg, backdrop);
    if (sameColor(painted, backdrop)) continue;
    const ratio = contrastRatio(painted, backdrop);
    if (ratio < MIN_SURFACE_RATIO) {
      out.push({
        kind: 'contrast-surface',
        sel: e.sel,
        detail: `surface is ${ratio.toFixed(3)}:1 against its backdrop — invisible (need ${MIN_SURFACE_RATIO})`,
        severity: 'warn',
      });
    }
  }
  return out;
}

function textFindings(p: ProbeResult): Finding[] {
  const out: Finding[] = [];
  for (const e of p.elements) {
    if (!e.hasDirectText || !isOpaqueEnough(e.color)) continue;
    const backdrop = textBackdropOf(e, p.rootBg);
    if (!backdrop) continue;
    const fg = compositeOver(e.color, backdrop);
    const need = isLargeText(e) ? MIN_LARGE_TEXT_RATIO : MIN_TEXT_RATIO;
    const ratio = contrastRatio(fg, backdrop);
    if (ratio < need) {
      const label = e.text ? ` "${e.text.slice(0, 24)}"` : '';
      out.push({
        kind: 'contrast-text',
        sel: e.sel,
        detail: `text${label} is ${ratio.toFixed(2)}:1 (need ${need})`,
        severity: 'warn',
      });
    }
  }
  return out;
}

function collisionFindings(p: ProbeResult): Finding[] {
  const out: Finding[] = [];
  const texts = p.elements.filter((e) => e.hasDirectText && area(e.rect) > 0);
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i]!;
      const b = texts[j]!;
      // A descendant necessarily sits inside its ancestor — not a collision.
      if (a.ancestors.includes(b.idx) || b.ancestors.includes(a.idx)) continue;
      const share = overlapShare(a.rect, b.rect);
      if (share > COLLISION_OVERLAP_SHARE) {
        out.push({
          kind: 'collision',
          sel: `${a.sel} × ${b.sel}`,
          detail: `text boxes overlap by ${Math.round(share * 100)}%`,
          severity: 'error',
        });
      }
    }
  }
  return out;
}

function capPerKind(findings: Finding[]): Finding[] {
  const seen = new Map<FindingKind, number>();
  const out: Finding[] = [];
  for (const f of findings) {
    const n = (seen.get(f.kind) ?? 0) + 1;
    seen.set(f.kind, n);
    if (n <= MAX_PER_KIND) out.push(f);
    else if (n === MAX_PER_KIND + 1) {
      out.push({
        kind: f.kind,
        sel: '…',
        detail: `more ${f.kind} findings suppressed — fix these first`,
        severity: f.severity,
      });
    }
  }
  return out;
}

/** Judge a probe. Errors first, then warnings; both capped per kind. */
export function analyzeProbe(p: ProbeResult): Finding[] {
  const all = [
    ...overflowFindings(p),
    ...collisionFindings(p),
    ...surfaceFindings(p),
    ...textFindings(p),
  ];
  const rank = (f: Finding) => (f.severity === 'error' ? 0 : 1);
  return capPerKind(all.sort((a, b) => rank(a) - rank(b)));
}

/** Which app shell the dev webapp actually rendered. */
export type Shell = 'desktop' | 'phone' | 'none' | 'both';

export function describeShell(hasDesktop: boolean, hasPhone: boolean): Shell {
  if (hasDesktop && hasPhone) return 'both';
  if (hasDesktop) return 'desktop';
  if (hasPhone) return 'phone';
  return 'none';
}

/**
 * Fail a run that measured the wrong shell.
 *
 * The desktop tree (Sidebar + AppMain) and the phone tree (MobileApp) are
 * different components, and the dev webapp picks between them by viewport. A
 * desktop sweep run at a phone width therefore photographs MobileApp and
 * reports it clean — the screen under test never appeared. `none` is its own
 * failure: an app that never mounted measures as a blank page with no findings,
 * which also reads as success.
 */
export function assertShell(expected: 'desktop' | 'phone', actual: Shell, width: number): void {
  if (actual === expected) return;
  const why =
    actual === 'none'
      ? 'no app shell mounted at all — the page is blank or still booting'
      : `the ${actual} shell rendered instead`;
  throw new Error(
    `Expected the ${expected} shell at ${width}px, but ${why}. ` +
      'Nothing measured in this run describes the screen you asked for. ' +
      (expected === 'desktop'
        ? 'The desktop tree needs a viewport above the phone breakpoint, and ?mobile=0 on the URL.'
        : 'The phone tree needs a width below 767px, or ?mobile=1 on the URL.')
  );
}

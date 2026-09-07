import { describe, it, expect } from 'vitest';
import {
  analyzeProbe,
  assertShell,
  describeShell,
  type ProbeElement,
  type ProbeResult,
} from '../uiFindings';
import { parseCssColor, OPAQUE_BLACK } from '../contrast';

const BASE_200 = parseCssColor('#0f172a')!;
const BASE_300 = parseCssColor('#111827')!;
const SLATE_700 = parseCssColor('#334155')!;
const WHITE = parseCssColor('#ffffff')!;

function el(over: Partial<ProbeElement> = {}): ProbeElement {
  return {
    idx: 0,
    ancestors: [],
    sel: 'div',
    text: '',
    rect: { x: 0, y: 0, w: 100, h: 20 },
    bg: null,
    bgChain: [BASE_200],
    color: null,
    fontSize: 14,
    fontWeight: 400,
    hasDirectText: false,
    ...over,
  };
}

function probe(elements: ProbeElement[], over: Partial<ProbeResult> = {}): ProbeResult {
  return {
    width: 390,
    height: 844,
    docScrollWidth: 390,
    docClientWidth: 390,
    elements,
    ...over,
  };
}

const kinds = (f: { kind: string }[]) => f.map((x) => x.kind);

describe('analyzeProbe — horizontal overflow', () => {
  // reIS clips at #root, so the document never scrolls horizontally. Nesting
  // the per-element rule inside the document-scroll check made it unable to
  // fire in this app at all — proven by injecting a 2000px element and getting
  // nothing back. Clipped is worse than scrolled: the content is unreachable
  // and there is no scrollbar to hint that anything is missing.
  // Leaflet lays tiles beyond the map pane and clips them. Reporting those
  // produced 26 failures on the map screen alone — enough to fail every PR.
  // The exclusion must stay narrow: app content living inside the map — a
  // control, a popup, one of reIS's own overlays — can genuinely overflow, and
  // marking the whole .leaflet-container subtree would have hidden all of it.
  it('still reports an app-owned element inside the map that is NOT in a geometry pane', () => {
    const f = analyzeProbe(
      probe(
        [
          el({
            sel: 'div.leaflet-control',
            rect: { x: 0, y: 100, w: 900, h: 40 },
            insideInnerClip: false,
          }),
        ],
        { width: 320, docScrollWidth: 320, docClientWidth: 320 }
      )
    );
    expect(f.some((x) => x.kind === 'overflow-element' && x.sel === 'div.leaflet-control')).toBe(
      true
    );
  });

  it('ignores an element inside a third-party clipper', () => {
    const f = analyzeProbe(
      probe(
        [
          el({
            sel: 'img.leaflet-tile',
            rect: { x: -129, y: 100, w: 256, h: 256 },
            insideInnerClip: true,
          }),
        ],
        { width: 320, docScrollWidth: 320, docClientWidth: 320 }
      )
    );
    expect(kinds(f)).not.toContain('overflow-element');
  });

  it('reports an element hanging off the LEFT edge', () => {
    const f = analyzeProbe(
      probe([el({ sel: 'div.pinned', rect: { x: -20, y: 100, w: 100, h: 40 } })], {
        width: 320,
        docScrollWidth: 320,
        docClientWidth: 320,
      })
    );
    const hit = f.find((x) => x.kind === 'overflow-element' && x.sel === 'div.pinned');
    expect(hit).toBeDefined();
    expect(hit!.detail).toMatch(/starts 20px left of/);
  });

  it('does not flag an element that fits', () => {
    const f = analyzeProbe(
      probe([el({ sel: 'div.fits', rect: { x: 0, y: 100, w: 320, h: 40 } })], {
        width: 320,
        docScrollWidth: 320,
        docClientWidth: 320,
      })
    );
    expect(kinds(f)).not.toContain('overflow-element');
  });

  it('reports an element past the viewport even when the document does not scroll', () => {
    const f = analyzeProbe(
      probe([el({ sel: 'div.wide-rail', rect: { x: 0, y: 100, w: 2000, h: 40 } })], {
        width: 320,
        docScrollWidth: 320,
        docClientWidth: 320,
      })
    );
    expect(f.some((x) => x.kind === 'overflow-element' && x.sel === 'div.wide-rail')).toBe(true);
    expect(kinds(f)).not.toContain('overflow');
  });

  it('reports nothing when the document fits', () => {
    expect(analyzeProbe(probe([]))).toEqual([]);
  });

  it('flags a document wider than its viewport', () => {
    const f = analyzeProbe(probe([], { docScrollWidth: 430, docClientWidth: 390 }));
    expect(kinds(f)).toContain('overflow');
    expect(f[0]!.detail).toMatch(/40px/);
  });

  it('ignores sub-pixel overflow from rounding', () => {
    const f = analyzeProbe(probe([], { docScrollWidth: 390.4, docClientWidth: 390 }));
    expect(kinds(f)).not.toContain('overflow');
  });

  it('names the element that sticks out past the viewport', () => {
    const f = analyzeProbe(
      probe([el({ sel: 'div.exam-rail', rect: { x: 300, y: 0, w: 200, h: 20 }, bg: SLATE_700 })], {
        docScrollWidth: 500,
        docClientWidth: 390,
      })
    );
    expect(f.some((x) => x.kind === 'overflow-element' && x.sel === 'div.exam-rail')).toBe(true);
  });
});

describe('analyzeProbe — surface contrast', () => {
  // The bug found three times in one session: a different token that is not
  // actually different to the eye.
  it('flags base-300 painted on base-200 in the dark theme', () => {
    const f = analyzeProbe(probe([el({ sel: 'div.rail', bg: BASE_300, bgChain: [BASE_200] })]));
    expect(kinds(f)).toContain('contrast-surface');
    expect(f[0]!.detail).toMatch(/1\.0/);
  });

  // Nesting containers that share a token is normal composition, not a defect.
  // Only a *different* colour that fails to read is a mistake.
  it('ignores an element whose background matches its backdrop exactly', () => {
    const f = analyzeProbe(probe([el({ bg: BASE_200, bgChain: [BASE_200] })]));
    expect(kinds(f)).not.toContain('contrast-surface');
  });

  it('accepts a surface that genuinely lifts off its backdrop', () => {
    const f = analyzeProbe(probe([el({ bg: SLATE_700, bgChain: [BASE_200] })]));
    expect(kinds(f)).not.toContain('contrast-surface');
  });

  it('composites alpha before judging, so a faint tint still fails', () => {
    const faint = { ...SLATE_700, a: 0.04 };
    const f = analyzeProbe(probe([el({ bg: faint, bgChain: [BASE_200] })]));
    expect(kinds(f)).toContain('contrast-surface');
  });

  it('skips fully transparent backgrounds', () => {
    const f = analyzeProbe(probe([el({ bg: { r: 0, g: 0, b: 0, a: 0 }, bgChain: [BASE_200] })]));
    expect(kinds(f)).not.toContain('contrast-surface');
  });

  it('skips zero-area elements', () => {
    const f = analyzeProbe(
      probe([el({ bg: BASE_300, bgChain: [BASE_200], rect: { x: 0, y: 0, w: 0, h: 0 } })])
    );
    expect(kinds(f)).not.toContain('contrast-surface');
  });

  it('falls through a transparent ancestor to the first painted backdrop', () => {
    const transparent = { r: 0, g: 0, b: 0, a: 0 };
    const f = analyzeProbe(probe([el({ bg: BASE_300, bgChain: [transparent, BASE_200] })]));
    expect(kinds(f)).toContain('contrast-surface');
  });

  // The browser paints every ancestor layer in turn. Stopping at the nearest
  // translucent one and compositing it straight onto the page backdrop skips
  // the layers between, so the judged colour is not the rendered pixel.
  it('composites the whole translucent ancestor stack, not just the nearest', () => {
    // Two stacked 50%-white veils over black render as rgb(191); one veil alone
    // renders as rgb(127). A surface of rgb(195) is therefore invisible on the
    // real two-veil backdrop (~1.03:1) but perfectly visible on rgb(127)
    // (~2.2:1) — so only correct full-stack compositing flags it.
    const veil = { ...WHITE, a: 0.5 };
    const surface = { r: 195, g: 195, b: 195, a: 1 };
    const stacked = analyzeProbe(
      probe([el({ bg: surface, bgChain: [veil, veil] })], { rootBg: OPAQUE_BLACK })
    );
    const single = analyzeProbe(
      probe([el({ bg: surface, bgChain: [veil] })], { rootBg: OPAQUE_BLACK })
    );
    expect(kinds(stacked)).toContain('contrast-surface');
    expect(kinds(single)).not.toContain('contrast-surface');
  });
});

describe('analyzeProbe — text contrast', () => {
  it('flags body text below the AA 4.5:1 threshold', () => {
    const f = analyzeProbe(
      probe([el({ hasDirectText: true, text: 'ZKO', color: BASE_300, bgChain: [BASE_200] })])
    );
    expect(kinds(f)).toContain('contrast-text');
  });

  it('passes white body text on a dark surface', () => {
    const f = analyzeProbe(
      probe([el({ hasDirectText: true, text: 'ZKO', color: WHITE, bgChain: [BASE_200] })])
    );
    expect(kinds(f)).not.toContain('contrast-text');
  });

  it('applies the relaxed 3:1 threshold to large text', () => {
    // A grey that lands between 3:1 and 4.5:1 on this backdrop.
    const grey = parseCssColor('#6b7280')!;
    const small = analyzeProbe(
      probe([
        el({ hasDirectText: true, text: 'x', color: grey, bgChain: [BASE_200], fontSize: 14 }),
      ])
    );
    const large = analyzeProbe(
      probe([
        el({ hasDirectText: true, text: 'x', color: grey, bgChain: [BASE_200], fontSize: 28 }),
      ])
    );
    expect(kinds(small)).toContain('contrast-text');
    expect(kinds(large)).not.toContain('contrast-text');
  });

  it('treats bold 18.66px+ as large text', () => {
    const grey = parseCssColor('#6b7280')!;
    const f = analyzeProbe(
      probe([
        el({
          hasDirectText: true,
          text: 'x',
          color: grey,
          bgChain: [BASE_200],
          fontSize: 19,
          fontWeight: 700,
        }),
      ])
    );
    expect(kinds(f)).not.toContain('contrast-text');
  });

  // A chip/badge/button paints its own background. Judging its label against
  // the ancestor surface instead measures a pair that is never drawn together.
  it('measures against the element own background when it paints one', () => {
    const chip = el({
      hasDirectText: true,
      text: '02.08',
      color: WHITE,
      bg: SLATE_700, // chip surface — white on this is legible
      bgChain: [WHITE], // ancestor is white — white-on-white would be a false alarm
    });
    expect(kinds(analyzeProbe(probe([chip])))).not.toContain('contrast-text');
  });

  it('still catches unreadable text on a painted chip', () => {
    const chip = el({
      hasDirectText: true,
      text: '02.08',
      color: BASE_300,
      bg: BASE_200,
      bgChain: [WHITE],
    });
    expect(kinds(analyzeProbe(probe([chip])))).toContain('contrast-text');
  });

  // Without the page backdrop, an unpainted container defaults to white and
  // white-on-dark text is reported as invisible — a false alarm on every
  // dark-theme screen.
  it('falls back to the page backdrop when no ancestor paints one', () => {
    const floating = el({ hasDirectText: true, text: 'Vybrat', color: WHITE, bgChain: [] });
    const withRoot = analyzeProbe(probe([floating], { rootBg: BASE_200 }));
    const withoutRoot = analyzeProbe(probe([floating], { rootBg: null }));
    expect(kinds(withRoot)).not.toContain('contrast-text');
    expect(kinds(withoutRoot)).not.toContain('contrast-text'); // no backdrop ⇒ no claim
  });

  it('ignores elements with no direct text', () => {
    const f = analyzeProbe(
      probe([el({ hasDirectText: false, color: BASE_300, bgChain: [BASE_200] })])
    );
    expect(kinds(f)).not.toContain('contrast-text');
  });
});

describe('analyzeProbe — collision', () => {
  const a = el({
    idx: 1,
    sel: 'span.date',
    hasDirectText: true,
    text: '12.02.',
    rect: { x: 0, y: 0, w: 100, h: 20 },
  });

  it('flags two text elements that substantially overlap', () => {
    const b = el({
      idx: 2,
      sel: 'span.title',
      hasDirectText: true,
      text: 'Zkouška',
      rect: { x: 10, y: 2, w: 100, h: 20 },
    });
    expect(kinds(analyzeProbe(probe([a, b])))).toContain('collision');
  });

  it('ignores merely adjacent text', () => {
    const b = el({
      idx: 2,
      sel: 'span.title',
      hasDirectText: true,
      text: 'Zkouška',
      rect: { x: 101, y: 0, w: 100, h: 20 },
    });
    expect(kinds(analyzeProbe(probe([a, b])))).not.toContain('collision');
  });

  it('ignores an ancestor/descendant pair that necessarily overlaps', () => {
    const child = el({
      idx: 2,
      ancestors: [1],
      sel: 'span.title',
      hasDirectText: true,
      text: 'Zkouška',
      rect: { x: 0, y: 0, w: 100, h: 20 },
    });
    expect(kinds(analyzeProbe(probe([a, child])))).not.toContain('collision');
  });
});

describe('analyzeProbe — output shape', () => {
  it('sorts errors before warnings', () => {
    const f = analyzeProbe(
      probe([el({ bg: BASE_300, bgChain: [BASE_200] })], {
        docScrollWidth: 500,
        docClientWidth: 390,
      })
    );
    const firstWarn = f.findIndex((x) => x.severity === 'warn');
    const lastError = f.map((x) => x.severity).lastIndexOf('error');
    expect(firstWarn === -1 || lastError < firstWarn).toBe(true);
  });
});

describe('describeShell / assertShell', () => {
  it('names whichever shell mounted', () => {
    expect(describeShell(true, false)).toBe('desktop');
    expect(describeShell(false, true)).toBe('phone');
    expect(describeShell(false, false)).toBe('none');
    expect(describeShell(true, true)).toBe('both');
  });

  it('passes when the shell is the one asked for', () => {
    expect(() => assertShell('desktop', 'desktop', 1440)).not.toThrow();
  });

  it('fails a desktop sweep that actually photographed the phone tree', () => {
    // The whole point: this run would otherwise report "no findings" about a
    // screen that never rendered.
    expect(() => assertShell('desktop', 'phone', 390)).toThrow(/phone shell rendered instead/);
  });

  it('treats a page where nothing mounted as a failure, not a clean run', () => {
    expect(() => assertShell('desktop', 'none', 1440)).toThrow(/no app shell mounted/);
  });

  it('says how to get the shell it wanted', () => {
    expect(() => assertShell('desktop', 'phone', 390)).toThrow(/\?mobile=0/);
    expect(() => assertShell('phone', 'desktop', 1440)).toThrow(/\?mobile=1/);
  });
});

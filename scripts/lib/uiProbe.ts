import type { ProbeResult } from './uiFindings';

/**
 * Runs inside the page and collects raw numbers only — rects, resolved RGBA,
 * font metrics. Every threshold and judgement lives in the tested
 * `uiFindings` module.
 *
 * Lives here rather than in a CLI because two tools need it: `scripts/shot.ts`
 * (screenshots on demand) and `scripts/check-app.ts` (the CI gate). It is
 * serialised into the browser by `page.evaluate`, so it must not close over
 * anything from module scope.
 */
export function probeSource(): ProbeResult {
  const MAX_ELEMENTS = 1500;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Resolve any CSS colour the browser understands — including the oklch()
  // that Tailwind 4 / DaisyUI 5 emit and getComputedStyle returns verbatim.
  const colorCache = new Map<string, { r: number; g: number; b: number; a: number } | null>();
  function resolveColor(css: string) {
    if (!css) return null;
    const hit = colorCache.get(css);
    if (hit !== undefined) return hit;
    let out: { r: number; g: number; b: number; a: number } | null = null;
    try {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      out = { r: d[0]!, g: d[1]!, b: d[2]!, a: d[3]! / 255 };
    } catch {
      out = null;
    }
    colorCache.set(css, out);
    return out;
  }

  const nodes: HTMLElement[] = [];
  const indexOf = new Map<HTMLElement, number>();
  for (const node of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
    if (nodes.length >= MAX_ELEMENTS) break;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
      continue;
    const r = node.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    // Occlusion test: anything a modal/overlay covers is not on screen, and
    // measuring it produces findings about a page the user cannot see.
    const hit = document.elementFromPoint(
      Math.min(Math.max(r.x + r.width / 2, 0), window.innerWidth - 1),
      Math.min(Math.max(r.y + r.height / 2, 0), window.innerHeight - 1)
    );
    if (!hit || (hit !== node && !node.contains(hit) && !hit.contains(node))) continue;
    indexOf.set(node, nodes.length);
    nodes.push(node);
  }

  // Four classes, not two. `button.w-full.flex` matches a dozen buttons in this
  // app, and a finding you cannot locate is a finding you cannot fix — tracing
  // one cost more time than fixing three.
  const describe = (node: HTMLElement) => {
    const cls = Array.from(node.classList).slice(0, 4).join('.');
    return (node.tagName.toLowerCase() + (cls ? `.${cls}` : '')).slice(0, 110);
  };

  // Third-party widgets that position their own internals outside their box
  // and clip them. Leaflet lays tiles beyond the map pane on purpose — 26 of
  // them were reported as layout failures, enough to fail every PR.
  //
  // Deliberately a named-widget exclusion rather than "skip anything with a
  // clipping ancestor": that broader rule excused every element inside a
  // scrolling screen container, which is most of the app, and silently killed
  // the check for the second time. Verified by re-injecting a 1400px row and
  // watching it go unreported.
  // Leaflet's own geometry panes, NOT the whole `.leaflet-container`. The
  // container's subtree also holds map controls, popups and reIS's own
  // overlays — all app-owned content that CAN genuinely overflow and must
  // still be reported. Only the two panes Leaflet transform-positions beyond
  // the viewport are excused: the tile pane, and the overlay pane that carries
  // the zoom-animated SVG and its paths. Those were the exact selectors that
  // produced 26 false failures.
  const THIRD_PARTY_CLIPPERS = '.leaflet-tile-pane, .leaflet-overlay-pane';
  const insideThirdPartyClipper = (node: HTMLElement): boolean =>
    node.closest(THIRD_PARTY_CLIPPERS) !== null;

  const elements = nodes.map((node, idx) => {
    const style = getComputedStyle(node);
    const r = node.getBoundingClientRect();
    const insideInnerClip = insideThirdPartyClipper(node);

    const bgChain: { r: number; g: number; b: number; a: number }[] = [];
    const ancestors: number[] = [];
    for (let p = node.parentElement; p; p = p.parentElement) {
      const known = indexOf.get(p);
      if (known !== undefined) ancestors.push(known);
      const c = resolveColor(getComputedStyle(p).backgroundColor);
      if (c) bgChain.push(c);
      if (c && c.a >= 1) break; // fully opaque backdrop — nothing below matters
    }

    const hasDirectText = Array.from(node.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0
    );

    return {
      idx,
      ancestors,
      sel: describe(node),
      text: hasDirectText ? (node.textContent ?? '').trim().slice(0, 40) : '',
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      insideInnerClip,
      bg: resolveColor(style.backgroundColor),
      bgChain,
      color: resolveColor(style.color),
      fontSize: parseFloat(style.fontSize) || 16,
      fontWeight: parseInt(style.fontWeight, 10) || 400,
      hasDirectText,
    };
  });

  // The page's own backdrop. html usually inherits body's background, so try
  // both — without it, light text on an unpainted container scores as
  // illegible against an assumed white page.
  const rootBg =
    resolveColor(getComputedStyle(document.documentElement).backgroundColor) ??
    resolveColor(getComputedStyle(document.body).backgroundColor);

  return {
    width: window.innerWidth,
    height: window.innerHeight,
    docScrollWidth: document.documentElement.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
    rootBg:
      rootBg && rootBg.a > 0.01
        ? rootBg
        : resolveColor(getComputedStyle(document.body).backgroundColor),
    elements,
  };
}

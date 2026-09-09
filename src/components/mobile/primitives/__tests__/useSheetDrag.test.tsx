import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { useSheetDrag, type SheetDragConfig } from '../useSheetDrag';
import { DRAG_SLOP_PX } from '../sheetDrag';

/**
 * The shared drag gesture, tested on its own.
 *
 * This hook replaced two separate implementations — `Sheet`'s inline handlers
 * and `useMapSheetDrag` — each missing a different mechanism, which is how "the
 * slidedown bugs all the time, it's not fluent" came to be true of most of the
 * app. These cases pin all four mechanisms so neither copy can drift back:
 * ownership, the non-passive touch claim, pointer capture, and click
 * suppression.
 */

type Recorded = {
  moves: [number, number][];
  ends: [number, number][];
  /**
   * Cancellations, as an array rather than a counter.
   *
   * `react-hooks/immutability` forbids `rec.cancels += 1` — assignment into a
   * prop member — and aliasing the prop does not satisfy it, because the rule
   * follows the alias. Pushing onto an array it already holds is the same kind
   * of recording the other two fields do, and needs no compound assignment.
   */
  cancels: unknown[];
  /** What onEnd should report back: did the gesture move the sheet? */
  claim?: boolean;
};

function Harness({
  rec,
  ...cfg
}: { rec: Recorded } & Partial<
  Omit<SheetDragConfig, 'panelRef' | 'onMove' | 'onEnd' | 'onCancel'>
>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { handlers, consumeDragClick } = useSheetDrag({
    panelRef,
    onMove: (dy, h) => rec.moves.push([dy, h]),
    // The second argument is the release VELOCITY in px/ms, not a duration —
    // it was renamed when the drag stopped averaging over the whole gesture,
    // and this harness kept calling it `dt`.
    onEnd: (dy, velocity) => {
      rec.ends.push([dy, velocity]);
      return rec.claim;
    },
    onCancel: () => rec.cancels.push(1),
    ...cfg,
  });
  return (
    <div ref={panelRef} data-testid="panel" {...handlers}>
      <button data-testid="inner" onClick={() => rec.moves.push([-1, -1])}>
        tap me
      </button>
      <div data-testid="scroller" style={{ overflowY: 'auto' }}>
        content
      </div>
      <button data-testid="guarded" onClick={() => consumeDragClick() || rec.ends.push([-1, -1])}>
        guarded
      </button>
    </div>
  );
}

const fresh = (): Recorded => ({ moves: [], ends: [], cancels: [] });

describe('useSheetDrag', () => {
  let rec: Recorded;
  beforeEach(() => {
    rec = fresh();
  });

  const panel = () => screen.getByTestId('panel');

  it('reports travel while the finger moves', () => {
    render(<Harness rec={rec} />);
    fireEvent.pointerDown(panel(), { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(panel(), { clientY: 150, pointerId: 1 });
    fireEvent.pointerMove(panel(), { clientY: 220, pointerId: 1 });
    expect(rec.moves.map(([dy]) => dy)).toEqual([50, 120]);
  });

  /**
   * Travel only. happy-dom stamps its own event timeStamps and ignores the ones
   * fireEvent is given, so a duration cannot be expressed here at all — the
   * same reason sheetDrag.test.ts leaves the distance-vs-velocity rules to the
   * pure functions. What this pins is that the gesture is reported once, with
   * the total travel from where the finger went down.
   */
  it('reports the finished gesture once, with its total travel', () => {
    render(<Harness rec={rec} />);
    fireEvent.pointerDown(panel(), { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(panel(), { clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(panel(), { clientY: 300, pointerId: 1 });
    expect(rec.ends).toHaveLength(1);
    expect(rec.ends[0]?.[0]).toBe(200);
  });

  it('reports nothing at all before a pointerdown', () => {
    render(<Harness rec={rec} />);
    fireEvent.pointerMove(panel(), { clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(panel(), { clientY: 300, pointerId: 1 });
    expect(rec.moves).toEqual([]);
    expect(rec.ends).toEqual([]);
  });

  // 1. Ownership.
  it('refuses the gesture while a scroller under the finger is scrolled down', () => {
    render(<Harness rec={rec} />);
    const scroller = screen.getByTestId('scroller');
    Object.defineProperty(scroller, 'scrollTop', { value: 40, configurable: true });
    Object.defineProperty(scroller, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(scroller, 'clientHeight', { value: 100, configurable: true });
    fireEvent.pointerDown(scroller, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(panel(), { clientY: 300, pointerId: 1 });
    expect(rec.moves).toEqual([]);
  });

  // 2. The touch claim — the mechanism the reported bug was missing.
  //
  // Asserted as "a NON-PASSIVE touchmove", not "a touchmove": React attaches
  // its own touch listeners, passively, at the root. Passive is precisely the
  // useless kind here — `preventDefault` from one is a no-op — so counting any
  // touchmove would pass on React's alone and prove nothing.
  const nonPassiveTouchmoves = (spy: ReturnType<typeof vi.spyOn>) =>
    spy.mock.calls.filter(
      ([type, , opts]) =>
        type === 'touchmove' &&
        typeof opts === 'object' &&
        opts !== null &&
        (opts as AddEventListenerOptions).passive === false
    ).length;

  it('claims touchmove non-passively, so the browser cannot pan it away', () => {
    const spy = vi.spyOn(Element.prototype, 'addEventListener');
    render(<Harness rec={rec} />);
    expect(nonPassiveTouchmoves(spy)).toBeGreaterThan(0);
    spy.mockRestore();
  });

  it('does not claim the gesture when dragging is disabled', () => {
    const spy = vi.spyOn(Element.prototype, 'addEventListener');
    render(<Harness rec={rec} disabled />);
    expect(nonPassiveTouchmoves(spy)).toBe(0);
    spy.mockRestore();
  });

  // 3. Pointer capture.
  it('captures the pointer so a long drag survives leaving the panel', () => {
    render(<Harness rec={rec} />);
    const capture = vi.fn();
    (panel() as unknown as { setPointerCapture: unknown }).setPointerCapture = capture;
    fireEvent.pointerDown(panel(), { clientY: 100, pointerId: 9 });
    fireEvent.pointerMove(panel(), { clientY: 100 + DRAG_SLOP_PX, pointerId: 9 });
    expect(capture).toHaveBeenCalledWith(9);
  });

  /**
   * Capturing on `pointerdown` broke every button inside every sheet under a
   * MOUSE. While a pointer is captured WebKit fires the trailing `click` at the
   * CAPTURE element, not at what was pressed — measured in WebKit against the
   * search sheet: pressing "Zavrit" logged `gotpointercapture` on the panel and
   * then `click target=DIV`, and the sheet never closed. Touch never showed it
   * because iOS synthesises its click from the gesture recogniser rather than
   * from the pointer, which is why this only surfaced on reIS for Mac.
   *
   * So the press alone must capture nothing. A press that never moves is a tap.
   */
  it('captures nothing on a press that has not moved, so a click reaches its button', () => {
    render(<Harness rec={rec} />);
    const capture = vi.fn();
    (panel() as unknown as { setPointerCapture: unknown }).setPointerCapture = capture;
    fireEvent.pointerDown(panel(), { clientY: 100, pointerId: 9 });
    expect(capture).not.toHaveBeenCalled();
    // Jitter under the slop is still a tap, not a drag.
    fireEvent.pointerMove(panel(), { clientY: 100 + DRAG_SLOP_PX - 1, pointerId: 9 });
    expect(capture).not.toHaveBeenCalled();
  });

  it('captures once, not on every move of the same drag', () => {
    render(<Harness rec={rec} />);
    const capture = vi.fn();
    (panel() as unknown as { setPointerCapture: unknown }).setPointerCapture = capture;
    fireEvent.pointerDown(panel(), { clientY: 100, pointerId: 4 });
    fireEvent.pointerMove(panel(), { clientY: 140, pointerId: 4 });
    fireEvent.pointerMove(panel(), { clientY: 180, pointerId: 4 });
    fireEvent.pointerMove(panel(), { clientY: 220, pointerId: 4 });
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('does not capture travel the sheet refuses to absorb', () => {
    render(<Harness rec={rec} absorbs={() => false} />);
    const capture = vi.fn();
    (panel() as unknown as { setPointerCapture: unknown }).setPointerCapture = capture;
    fireEvent.pointerDown(panel(), { clientY: 100, pointerId: 7 });
    fireEvent.pointerMove(panel(), { clientY: 300, pointerId: 7 });
    expect(capture).not.toHaveBeenCalled();
  });

  it('releases the capture on release, so the next tap is not swallowed', () => {
    render(<Harness rec={rec} />);
    const release = vi.fn();
    const p = panel() as unknown as Record<string, unknown>;
    p.setPointerCapture = () => {};
    p.hasPointerCapture = () => true;
    p.releasePointerCapture = release;
    fireEvent.pointerDown(panel(), { clientY: 100, pointerId: 3 });
    fireEvent.pointerUp(panel(), { clientY: 105, pointerId: 3 });
    expect(release).toHaveBeenCalledWith(3);
  });

  it('releases the capture on cancel too', () => {
    render(<Harness rec={rec} />);
    const release = vi.fn();
    const p = panel() as unknown as Record<string, unknown>;
    p.setPointerCapture = () => {};
    p.hasPointerCapture = () => true;
    p.releasePointerCapture = release;
    fireEvent.pointerDown(panel(), { clientY: 100, pointerId: 5 });
    fireEvent.pointerCancel(panel(), { clientY: 200, pointerId: 5 });
    expect(release).toHaveBeenCalledWith(5);
  });

  it('treats a cancel as "put it back", never as a finished gesture', () => {
    render(<Harness rec={rec} />);
    fireEvent.pointerDown(panel(), { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(panel(), { clientY: 400, pointerId: 1 });
    fireEvent.pointerCancel(panel(), { clientY: 400, pointerId: 1 });
    expect(rec.cancels).toHaveLength(1);
    expect(rec.ends).toEqual([]);
  });

  it('forgets a cancelled gesture, so the next move is not a continuation', () => {
    render(<Harness rec={rec} />);
    fireEvent.pointerDown(panel(), { clientY: 100, pointerId: 1 });
    fireEvent.pointerCancel(panel(), { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(panel(), { clientY: 500, pointerId: 1 });
    expect(rec.moves).toEqual([]);
  });

  // 4. Click suppression.
  it('swallows the click a drag ends in', () => {
    render(<Harness rec={rec} />);
    const inner = screen.getByTestId('inner');
    fireEvent.pointerDown(inner, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(inner, { clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(inner, { clientY: 300, pointerId: 1 });
    fireEvent.click(inner);
    // The inner button pushes [-1,-1] when it actually fires.
    expect(rec.moves.some(([dy]) => dy === -1)).toBe(false);
  });

  it('lets an ordinary tap through, jitter and all', () => {
    render(<Harness rec={rec} />);
    const inner = screen.getByTestId('inner');
    fireEvent.pointerDown(inner, { clientY: 100, pointerId: 1 });
    // Under the slop: a finger is never perfectly still.
    fireEvent.pointerMove(inner, { clientY: 103, pointerId: 1 });
    fireEvent.pointerUp(inner, { clientY: 103, pointerId: 1 });
    fireEvent.click(inner);
    expect(rec.moves.some(([dy]) => dy === -1)).toBe(true);
  });

  it('offers consumeDragClick for controls that guard themselves', () => {
    render(<Harness rec={rec} />);
    const guarded = screen.getByTestId('guarded');
    fireEvent.pointerDown(guarded, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(guarded, { clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(guarded, { clientY: 300, pointerId: 1 });
    // The capture handler eats the click first, so the guard never even runs —
    // which is the point: neither path fires the action.
    fireEvent.click(guarded);
    expect(rec.ends.some(([dy]) => dy === -1)).toBe(false);
  });

  /**
   * The case that broke the map sheet when this hook first replaced its own
   * copy: a fast flick shorter than the slop changes a detent, so the sheet
   * moves without the gesture ever counting as a drag — and the trailing click
   * then advanced a SECOND stop, making one flick jump two.
   */
  it('lets onEnd claim the gesture, swallowing the click a sub-slop flick ends in', () => {
    rec.claim = true;
    render(<Harness rec={rec} />);
    const inner = screen.getByTestId('inner');
    fireEvent.pointerDown(inner, { clientY: 100, pointerId: 1 });
    // Under DRAG_SLOP_PX: never counted as a drag by travel alone.
    fireEvent.pointerMove(inner, { clientY: 104, pointerId: 1 });
    fireEvent.pointerUp(inner, { clientY: 104, pointerId: 1 });
    fireEvent.click(inner);
    expect(rec.moves.some(([dy]) => dy === -1)).toBe(false);
  });

  it('leaves the click alone when onEnd claims nothing', () => {
    rec.claim = false;
    render(<Harness rec={rec} />);
    const inner = screen.getByTestId('inner');
    fireEvent.pointerDown(inner, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(inner, { clientY: 104, pointerId: 1 });
    fireEvent.pointerUp(inner, { clientY: 104, pointerId: 1 });
    fireEvent.click(inner);
    expect(rec.moves.some(([dy]) => dy === -1)).toBe(true);
  });

  it('honours absorbs: travel it refuses is neither reported nor claimed', () => {
    // A bottom sheet absorbs downward only.
    render(<Harness rec={rec} absorbs={(dy) => dy > 0} />);
    fireEvent.pointerDown(panel(), { clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(panel(), { clientY: 200, pointerId: 1 });
    expect(rec.moves).toEqual([]);
    fireEvent.pointerMove(panel(), { clientY: 400, pointerId: 1 });
    expect(rec.moves.map(([dy]) => dy)).toEqual([100]);
  });

  it('hands the panel height at gesture start to onMove', () => {
    render(<Harness rec={rec} />);
    const p = panel();
    vi.spyOn(p, 'getBoundingClientRect').mockReturnValue({ height: 420 } as DOMRect);
    fireEvent.pointerDown(p, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(p, { clientY: 150, pointerId: 1 });
    expect(rec.moves).toEqual([[50, 420]]);
  });

  it('does nothing at all when disabled', () => {
    render(<Harness rec={rec} disabled />);
    fireEvent.pointerDown(panel(), { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(panel(), { clientY: 400, pointerId: 1 });
    fireEvent.pointerUp(panel(), { clientY: 400, pointerId: 1 });
    expect(rec.moves).toEqual([]);
    expect(rec.ends).toEqual([]);
  });
});

/**
 * The touch claim has to answer for the sheet's CURRENT state.
 *
 * The listener is bound once and deliberately never re-bound — re-binding a
 * non-passive listener on every render is its own problem. What was wrong is
 * where it read `absorbs` from: the effect's own scope, which freezes the
 * predicate of the render the effect happened to run in. `Sheet` never noticed,
 * because downward-only is the same answer forever. The map sheet asks its
 * detent, so its listener went on answering as whatever stop the sheet was at
 * when it mounted — and at `peek`, where a downward drag belongs to the Akce
 * list, a listener still answering for `half` claims it and the list stops
 * scrolling.
 *
 * Found on a running dev server: `absorbs` was removed from `Sheet` and the
 * touch claim did not change.
 */
describe('useSheetDrag — the touch claim follows the current absorbs', () => {
  function Host({ absorbs }: { absorbs: (dy: number) => boolean }) {
    const panelRef = useRef<HTMLDivElement>(null);
    const { handlers } = useSheetDrag({
      panelRef,
      absorbs,
      onMove: () => {},
      onEnd: () => {},
      onCancel: () => {},
    });
    return <div ref={panelRef} data-testid="panel" {...handlers} />;
  }

  /** A touchmove the listener can read, without happy-dom's Touch plumbing. */
  const touchMove = (panel: HTMLElement, clientY: number) => {
    const ev = new Event('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'touches', { value: [{ clientY }] });
    panel.dispatchEvent(ev);
    return ev.defaultPrevented;
  };

  it('honours an absorbs replaced after the listener was bound', () => {
    // Mounted absorbing DOWNWARD travel only.
    const { rerender } = render(<Host absorbs={(dy) => dy > 0} />);
    const panel = screen.getByTestId('panel');

    fireEvent.pointerDown(panel, { clientY: 300, pointerId: 1 });
    expect(touchMove(panel, 360)).toBe(true); // down: claimed
    fireEvent.pointerUp(panel, { clientY: 360, pointerId: 1 });

    // Now it absorbs UPWARD only — the map sheet's answer changes exactly like
    // this when its detent changes.
    rerender(<Host absorbs={(dy) => dy < 0} />);
    fireEvent.pointerDown(panel, { clientY: 300, pointerId: 2 });
    expect(touchMove(panel, 360)).toBe(false); // down: no longer ours
    expect(touchMove(panel, 240)).toBe(true); // up: now ours
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sheet } from '../Sheet';

/**
 * The drag has to survive the browser trying to take it.
 *
 * Reported as "the slidedown bugs all the time, it's not fluent; when I try to
 * pull it down it just disappears, then appears again weirdly" — one gesture,
 * two different outcomes, at random.
 *
 * The mechanism was already written down in this repo. `MapSheet` carries a
 * comment saying it was MEASURED on device: with the default `touch-action` the
 * browser claims the gesture as a pan partway through and fires
 * `pointercancel`, "measured on device for the other sheets, where a 350px
 * swipe was cut off after ~20px". `useMapSheetDrag` therefore attaches a
 * NON-PASSIVE touchmove and calls `preventDefault` while the sheet owns the
 * gesture. The generic `Sheet` — every other sheet in the app — never got any
 * of that, so:
 *
 *  - the browser steals the pan → `pointercancel` → `dragY` resets → the sheet
 *    snaps back under the finger ("appears again weirdly"), and
 *  - when the steal comes after the dismiss threshold instead, the sheet closes
 *    ("just disappears").
 *
 * Same gesture, different outcome depending on when the steal lands, which is
 * exactly what "bugs all the time" describes.
 *
 * Pointer capture is the second half: without it the events stop arriving the
 * moment the finger leaves the panel, so a long drag simply stalls.
 */
describe('Sheet drag fluency', () => {
  it('captures the pointer once the press becomes a drag, so it survives leaving the panel', () => {
    render(
      <Sheet size="content" onClose={() => {}}>
        body
      </Sheet>
    );
    const panel = screen.getByTestId('sheet-panel');
    const capture = vi.fn();
    // happy-dom does not implement it; the assertion is that Sheet ASKS.
    (panel as unknown as { setPointerCapture: unknown }).setPointerCapture = capture;
    fireEvent.pointerDown(panel, { clientY: 300, pointerId: 7 });
    // Not on the press: a captured pointer makes WebKit fire the trailing click
    // at the panel, which killed every button inside every sheet under a mouse
    // (reIS for Mac). See the `captured` ref in useSheetDrag.
    expect(capture).not.toHaveBeenCalled();
    fireEvent.pointerMove(panel, { clientY: 340, pointerId: 7 });
    expect(capture).toHaveBeenCalledWith(7);
  });

  it('claims the touch gesture so the browser cannot pan it away mid-drag', () => {
    const spy = vi.spyOn(Element.prototype, 'addEventListener');
    render(
      <Sheet size="content" onClose={() => {}}>
        body
      </Sheet>
    );
    const nonPassiveTouchmove = spy.mock.calls.some(([type, , opts]) =>
      type === 'touchmove' && typeof opts === 'object' && opts !== null && 'passive' in opts
        ? (opts as AddEventListenerOptions).passive === false
        : false
    );
    expect(nonPassiveTouchmove).toBe(true);
    spy.mockRestore();
  });

  it('does not dismiss when the browser cancels the gesture', () => {
    // A cancel is the browser taking over, not the student letting go — the
    // only honest outcome is to put the sheet back.
    const onClose = vi.fn();
    render(
      <Sheet size="content" onClose={onClose}>
        body
      </Sheet>
    );
    const panel = screen.getByTestId('sheet-panel');
    fireEvent.pointerDown(panel, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(panel, { clientY: 400, pointerId: 1 });
    fireEvent.pointerCancel(panel, { clientY: 400, pointerId: 1 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('still dismisses on a real, completed downward drag', () => {
    const onClose = vi.fn();
    render(
      <Sheet size="content" onClose={onClose}>
        body
      </Sheet>
    );
    const panel = screen.getByTestId('sheet-panel');
    fireEvent.pointerDown(panel, { clientY: 100, pointerId: 1, timeStamp: 0 });
    fireEvent.pointerMove(panel, { clientY: 400, pointerId: 1, timeStamp: 200 });
    fireEvent.pointerUp(panel, { clientY: 400, pointerId: 1, timeStamp: 200 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('releases the capture when the gesture ends, so the next tap is not swallowed', () => {
    render(
      <Sheet size="content" onClose={() => {}}>
        body
      </Sheet>
    );
    const panel = screen.getByTestId('sheet-panel');
    const release = vi.fn();
    (panel as unknown as { setPointerCapture: unknown }).setPointerCapture = () => {};
    (panel as unknown as { releasePointerCapture: unknown }).releasePointerCapture = release;
    (panel as unknown as { hasPointerCapture: unknown }).hasPointerCapture = () => true;
    fireEvent.pointerDown(panel, { clientY: 300, pointerId: 4 });
    fireEvent.pointerUp(panel, { clientY: 310, pointerId: 4 });
    expect(release).toHaveBeenCalledWith(4);
  });
});

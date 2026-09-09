import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { dragOwnsGesture, releaseVelocity, DRAG_SLOP_PX, type DragSample } from './sheetDrag';

export interface SheetDragConfig {
  /** The panel being dragged. Ownership and pointer capture are scoped to it. */
  panelRef: RefObject<HTMLElement | null>;
  /** Skip dragging entirely — `Sheet variant="screen"` is left via back. */
  disabled?: boolean;
  /**
   * Whether travel in this direction can be absorbed at all. A bottom sheet
   * absorbs downward only; the map sheet asks its detent ladder. Travel that is
   * not absorbed belongs to whatever is under the finger, so it is neither
   * reported nor claimed from the browser.
   */
  absorbs?: (dy: number) => boolean;
  /** Live travel, with the panel's height when the gesture started. */
  onMove: (dy: number, startHeight: number) => void;
  /**
   * The gesture finished: decide the outcome, given the RELEASE velocity in
   * px/ms (downward positive) rather than the gesture's average.
   *
   * Return `true` when it MOVED the sheet, to swallow the click it ends in. The
   * slop and the outcome measure different things and disagree on a fast flick
   * shorter than the slop: too small to count as a drag, fast enough to change
   * a detent. The sheet would move AND the trailing click would land on
   * whatever was under the finger — on the map sheet that advanced a second
   * stop, so one flick jumped two. Whether the gesture moved the sheet is the
   * question that matters, so the caller gets the final say.
   */
  onEnd: (dy: number, velocity: number, startHeight: number) => boolean | void;
  /** The browser took the gesture, or it was abandoned. Put things back. */
  onCancel: () => void;
}

/**
 * The one drag gesture behind every mobile sheet.
 *
 * There were two implementations of this and both were wrong in different
 * ways — `Sheet`'s inline handlers and `useMapSheetDrag` — which is how "the
 * slidedown bugs all the time, it's not fluent; when I try to pull it down it
 * just disappears, then appears again weirdly" came to be true of most of the
 * app while the map sheet felt fine.
 *
 * Four mechanisms, and a sheet needs all four:
 *
 * 1. **Ownership.** `dragOwnsGesture` refuses the gesture while any scroller
 *    under the finger is scrolled past its top, so reading a long list never
 *    costs the student their place.
 * 2. **The touch claim.** React attaches touch listeners PASSIVELY, so
 *    `preventDefault` from a React handler is a no-op and the browser is free
 *    to decide partway through that the gesture is a pan of its own and fire
 *    `pointercancel`. Measured on device: a 350px swipe cut off after ~20px.
 *    That is the reported bug — the steal lands before the dismiss threshold
 *    and the sheet snaps back, or after it and the sheet closes, from one
 *    gesture. Only a manual non-passive listener can hold the gesture.
 * 3. **Pointer capture.** Without it the events stop arriving the moment the
 *    finger leaves the panel: a long drag stalls, no `pointerup` ever lands,
 *    and `start` stays set so the NEXT touch continues the old drag. Taken on
 *    the first move PAST THE SLOP, never on the press — see `capture` below.
 * 4. **Click suppression.** A drag ends in a click on whatever was under the
 *    finger, which could cast an RSVP or follow a link as a side effect of
 *    closing. Swallowed once in the capture phase.
 *
 * What each sheet does with the travel is its own business — this reports it.
 */
export function useSheetDrag({
  panelRef,
  disabled = false,
  absorbs,
  onMove,
  onEnd,
  onCancel,
}: SheetDragConfig) {
  /**
   * The gesture in progress, including WHICH pointer owns it.
   *
   * The id is load-bearing. Without it every `pointerdown` overwrote this, and
   * the move/up/cancel handlers took any pointer — so a second finger landing
   * mid-drag re-anchored the gesture to itself, and lifting the FIRST finger
   * decided the outcome from travel measured against the second finger's start.
   * Measured in a test: a 40px drag reported 260px, and a 30px release reported
   * 230px — past every dismiss threshold in the app. A pinch begun on the panel
   * or a thumb resting on the screen produces exactly that. Raised in review on
   * this PR.
   */
  const start = useRef<{ id: number; y: number; t: number; height: number } | null>(null);
  /**
   * The tail of the gesture, for the release velocity.
   *
   * Kept because "how fast was it moving when it was let go" is a different
   * question from "how far did it travel over how long", and only the first one
   * decides where a sheet should land. Trimmed to a couple of windows' worth so
   * a finger resting on the sheet for a minute does not grow an array.
   */
  const samples = useRef<DragSample[]>([]);
  /** Whether this gesture moved the sheet, so its trailing click must be eaten. */
  const dragged = useRef(false);
  /**
   * Whether this gesture has taken pointer capture yet.
   *
   * Capture is deferred to the first move past the slop, and this is what keeps
   * it to one call per gesture.
   *
   * It used to be taken on `pointerdown`, which broke EVERY button inside EVERY
   * sheet under a mouse. While a pointer is captured WebKit fires the trailing
   * `click` at the CAPTURE element rather than at what was pressed, so the
   * panel swallowed it and the button's onClick never ran. Measured in WebKit
   * against the search sheet: pressing "Zavřít" logged `gotpointercapture` on
   * the panel and then `click target=DIV`, and the sheet stayed open. Touch
   * never showed it — iOS synthesises its click from the gesture recogniser,
   * not from the pointer — so it surfaced only once reIS ran on a Mac, where
   * "Designed for iPad" delivers a real mouse. reIS on Mac, reported as
   * "many buttons don't work at all".
   *
   * A press that never moves is a tap and needs no capture: nothing has left
   * the panel, so there is nothing to keep. By the time the pointer HAS moved
   * far enough to be a drag, it is still on the panel — capture there is early
   * enough to hold everything mechanism 3 exists for.
   */
  const captured = useRef(false);

  const releaseCapture = (pointerId: number) => {
    const panel = panelRef.current;
    if (panel?.hasPointerCapture?.(pointerId)) panel.releasePointerCapture?.(pointerId);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    // Cleared before the ownership check, not after: a new gesture always
    // starts undragged. Leaving it to the owned path lets a flag set by a
    // previous drag survive into a gesture the sheet does not own, and the
    // click swallow below then eats that tap.
    dragged.current = false;
    if (disabled) return;
    // A gesture already in flight keeps the panel: a second finger is not a
    // new drag, and must not clear the flag above either.
    if (start.current) return;
    if (!dragOwnsGesture(e.target as Element, panelRef.current)) return;
    const height = panelRef.current?.getBoundingClientRect().height ?? 0;
    start.current = { id: e.pointerId, y: e.clientY, t: e.timeStamp, height };
    samples.current = [{ pos: e.clientY, t: e.timeStamp }];
    captured.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const from = start.current;
    if (!from || from.id !== e.pointerId) return;
    const dy = e.clientY - from.y;
    if (absorbs && !absorbs(dy)) return;
    // The sheet follows the finger from the first pixel, but only past the slop
    // does the gesture count as a drag for click suppression — otherwise the
    // jitter in an ordinary tap swallows it.
    if (Math.abs(dy) >= DRAG_SLOP_PX) {
      dragged.current = true;
      if (!captured.current) {
        captured.current = true;
        // Guarded: happy-dom implements neither this nor the release below.
        panelRef.current?.setPointerCapture?.(e.pointerId);
      }
    }
    samples.current.push({ pos: e.clientY, t: e.timeStamp });
    if (samples.current.length > 24) samples.current.shift();
    onMove(dy, from.height);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const from = start.current;
    if (from && from.id !== e.pointerId) return;
    start.current = null;
    captured.current = false;
    releaseCapture(e.pointerId);
    if (!from) return;
    samples.current.push({ pos: e.clientY, t: e.timeStamp });
    const velocity = releaseVelocity(samples.current);
    samples.current = [];
    if (onEnd(e.clientY - from.y, velocity, from.height) === true) dragged.current = true;
  };

  /**
   * A cancel is the BROWSER taking the gesture over, not the student letting
   * go — the only outcome is "put it back". A cancelled drag produces no click,
   * so the flag has nothing to suppress; left set it would eat the NEXT tap.
   */
  const onPointerCancel = (e: ReactPointerEvent<HTMLElement>) => {
    // A cancel for a finger we do not own says nothing about our drag, and
    // acting on it snapped the sheet back under a finger still holding it.
    if (start.current && start.current.id !== e.pointerId) return;
    start.current = null;
    samples.current = [];
    captured.current = false;
    releaseCapture(e.pointerId);
    dragged.current = false;
    onCancel();
  };

  const onClickCapture = (e: ReactMouseEvent<HTMLElement>) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  /**
   * `absorbs` through a ref, because the listener below must not re-bind.
   *
   * Reading it from the effect's own scope looked equivalent and is not: the
   * closure captures the `absorbs` of the render the effect RAN in, and the
   * deps are `[panelRef, disabled]`, so the effect never runs again. For this
   * sheet that is invisible — downward-only never changes — but the map sheet
   * asks its detent (`consumesTravel(sheetState, dy)`), so the listener kept
   * answering as whatever stop the sheet was at when it mounted. At `peek`,
   * where downward travel belongs to the Akce list, a listener still answering
   * for `half` claims it with preventDefault and the list cannot be scrolled.
   *
   * Found by removing `absorbs` from `Sheet` on a running dev server and
   * watching the touch claim not change.
   */
  const absorbsRef = useRef(absorbs);
  // In an effect, not during render: a ref written while rendering is a lint
  // error here, and an effect is early enough regardless — it commits before
  // any touch can reach the listener.
  useEffect(() => {
    absorbsRef.current = absorbs;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || disabled) return;
    const onTouchMove = (e: TouchEvent) => {
      const from = start.current;
      // The owning finger among however many are down, so a second touch
      // cannot redirect the claim.
      const touch =
        [...e.touches].find((t) => t.identifier === from?.id) ?? (from ? e.touches[0] : undefined);
      if (!from || !touch) return;
      const absorbsNow = absorbsRef.current;
      if (absorbsNow && !absorbsNow(touch.clientY - from.y)) return;
      e.preventDefault();
    };
    panel.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => panel.removeEventListener('touchmove', onTouchMove);
  }, [panelRef, disabled]);

  /**
   * For controls that must not fire when the gesture was a drag. The capture
   * handler already swallows those clicks; this is the belt to its braces, and
   * the map sheet's handle and tabs have always guarded themselves with it.
   */
  const consumeDragClick = () => {
    if (!dragged.current) return false;
    dragged.current = false;
    return true;
  };

  return {
    consumeDragClick,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture },
  };
}

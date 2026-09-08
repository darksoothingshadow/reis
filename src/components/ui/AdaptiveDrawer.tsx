import { useEffect, useRef, type ReactNode } from 'react';
import type React from 'react';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from './drawer';
import { useAppStore } from '../../store/useAppStore';
import { logError } from '../../utils/reportError';

interface AdaptiveDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Optional Tailwind width class for the desktop side-drawer branch (e.g. `sm:w-[800px]`). */
  width?: string;
  /** Accessible dialog title — required by Radix/vaul for screen readers; rendered visually hidden. */
  title?: string;
  children: ReactNode;
}

/**
 * Routes between two drawer styles based on the viewport slice:
 *   - phone (isTouch && isNarrow) → vaul bottom sheet, full-viewport-height minus
 *     the safe-area-inset-top, swipe-to-close, focus-into-view on inputs
 *   - everything else (desktop, tablet, narrow desktop) → existing fixed-overlay
 *     side drawer that all four call sites previously inlined
 * The four existing drawers (Exam, Erasmus, ClassmatePerson, SubjectFile) wrap
 * their inner content with this; the choice is invisible to them.
 */
export function AdaptiveDrawer({
  open,
  onClose,
  width = 'sm:w-[600px]',
  title = 'reIS',
  children,
}: AdaptiveDrawerProps) {
  const isTouch = useAppStore((s) => s.isTouch);
  const isNarrow = useAppStore((s) => s.isNarrow);
  const isPhone = isTouch && isNarrow;

  // Phone branch: vaul needs to observe open: true→false on a mounted host
  // to play its exit animation and to let an in-flight swipe-to-dismiss
  // complete. Don't short-circuit here.
  if (isPhone) {
    return (
      <Drawer
        open={open}
        onOpenChange={(o: boolean) => {
          if (!o) onClose();
        }}
        dismissible
      >
        <DrawerContent
          data-vaul-drawer-direction="bottom"
          className="flex flex-col"
          style={{
            height: 'calc(var(--app-vh, 100dvh) - var(--safe-top, 0px))',
            maxHeight: 'calc(var(--app-vh, 100dvh) - var(--safe-top, 0px))',
          }}
        >
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">{title}</DrawerDescription>
          <FocusIntoView>{children}</FocusIntoView>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop branch: the slide-in-from-right animation is enter-only, so
  // unmounting on close has no animation regression.
  if (!open) return null;

  // Isolate touch gestures from any ancestor swipe listener (e.g. WeeklyCalendar's
  // useSwipe on a touch laptop / tablet, where `isTouch && !isNarrow` lands in
  // this desktop branch). Restored from the pre-AdaptiveDrawer SubjectFileDrawer.
  const stopTouch = (e: React.TouchEvent) => e.stopPropagation();

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end items-stretch p-0 sm:p-4 isolate"
      onTouchStart={stopTouch}
      onTouchMove={stopTouch}
      onTouchEnd={stopTouch}
    >
      {/* The scrim has to dim a page that is ALREADY dark. black/15 over the
                dark theme measured 1.034:1 — the drawer floated with nothing
                separating it from the screen behind. */}
      <div className="absolute inset-0 bg-black/40 animate-in fade-in" onClick={onClose} />
      <div className="w-full flex justify-end items-start h-full pt-0 pb-0 sm:pt-10 sm:pb-10 relative z-10 pointer-events-none">
        <div
          role="dialog"
          className={`bg-base-100 shadow-2xl rounded-2xl flex flex-col h-full animate-in slide-in-from-right pointer-events-auto border border-base-300 relative w-full transition-[width] duration-300 ease-in-out ${width}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function FocusIntoView({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const handler = (e: FocusEvent) => {
      try {
        const t = e.target as HTMLElement | null;
        if (!t || typeof t.matches !== 'function') return;
        if (!t.matches('input, textarea, [contenteditable]')) return;
        t.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch (err) {
        logError('AdaptiveDrawer.focusScroll', err);
      }
    };
    root.addEventListener('focusin', handler);
    return () => root.removeEventListener('focusin', handler);
  }, []);
  return (
    <div ref={ref} className="flex flex-col flex-1 min-h-0">
      {children}
    </div>
  );
}

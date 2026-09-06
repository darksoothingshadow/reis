import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { RoomThumbnail } from './CampusMap/RoomThumbnail';

interface MapHoverCardProps {
  roomName: string;
  children: React.ReactNode;
  className?: string;
}

interface CardPosition {
  top: number;
  left: number;
  flip: boolean;
}

const HOVER_DELAY_MS = 450; // Slightly longer to match standard hover intent
const CARD_WIDTH = 420;
const CARD_HEIGHT = 320;

function computePosition(anchor: DOMRect): CardPosition {
  const spaceBelow = window.innerHeight - anchor.bottom;
  const spaceAbove = anchor.top;
  const flip = spaceBelow < CARD_HEIGHT + 20 && spaceAbove > spaceBelow;

  let left = anchor.left;
  if (left + CARD_WIDTH > window.innerWidth - 12) {
    left = window.innerWidth - CARD_WIDTH - 12;
  }

  return {
    top: flip ? anchor.top - CARD_HEIGHT - 8 : anchor.bottom + 8,
    left,
    flip,
  };
}

export function MapHoverCard({ roomName, children, className }: MapHoverCardProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<CardPosition | null>(null);

  const anchorRef = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelTimers = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  };

  const handleMouseEnter = useCallback(() => {
    cancelTimers();
    hoverTimer.current = setTimeout(() => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      setPos(computePosition(rect));
      setVisible(true);
    }, HOVER_DELAY_MS);
  }, []);

  const handleMouseLeave = useCallback(() => {
    cancelTimers();
    leaveTimer.current = setTimeout(() => setVisible(false), 150);
  }, []);

  const handleCardEnter = () => cancelTimers();
  const handleCardLeave = () => {
    cancelTimers();
    leaveTimer.current = setTimeout(() => setVisible(false), 150);
  };

  useEffect(() => () => cancelTimers(), []);

  const normalizedRoom = roomName.replace(/\s*\([^)]*\)\s*$/, '').trim() || roomName.trim();

  const card = (
    <AnimatePresence>
      {visible && pos && (
        <motion.div
          initial={{ opacity: 0, y: pos.flip ? 4 : -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: pos.flip ? 4 : -4, scale: 0.98 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          onMouseEnter={handleCardEnter}
          onMouseLeave={handleCardLeave}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            zIndex: 9999,
          }}
          className="bg-base-100 border border-base-300 rounded-xl shadow-popover-heavy overflow-hidden flex flex-col"
        >
          <div className="flex-1 bg-base-200 relative flex">
            <RoomThumbnail roomName={normalizedRoom} />
          </div>
          <div className="px-3 py-2 bg-base-100 border-t border-base-300 flex items-center justify-between">
            <span className="text-xs font-bold text-base-content/70 flex items-center gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-map-pin"
              >
                <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {normalizedRoom}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <span
        ref={anchorRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={className}
      >
        {children}
      </span>
      {typeof document !== 'undefined' && createPortal(card, document.body)}
    </>
  );
}

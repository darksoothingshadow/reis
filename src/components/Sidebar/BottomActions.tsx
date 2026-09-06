import { useRef, useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { OUTLOOK_ICON_PATH, TEAMS_ICON_PATH } from '../../constants/icons';
import { ProfilePopup } from './ProfilePopup';
import { useTranslation } from '../../hooks/useTranslation';

export function BottomActions({ onOpenFeedback }: { onOpenFeedback?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useTranslation();

  const handleEnter = () => {
    if (timeout.current) clearTimeout(timeout.current);
    setIsOpen(true);
  };
  const handleLeave = () => {
    timeout.current = setTimeout(() => setIsOpen(false), 300);
  };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="flex flex-col gap-2 mb-2 w-full px-2 items-center relative" ref={ref}>
      <a
        href="https://teams.microsoft.com"
        target="_blank"
        rel="noopener noreferrer"
        className="w-12 h-auto py-2 rounded-xl flex flex-col items-center justify-center text-base-content/70 hover:bg-base-100 hover:text-info group"
      >
        <img
          src={TEAMS_ICON_PATH}
          alt="Teams"
          className="w-8 h-8 group-hover:scale-110 transition-transform"
        />
        <span className="text-[10px] mt-1 font-medium">Teams</span>
      </a>
      <a
        href="https://outlook.office.com"
        target="_blank"
        rel="noopener noreferrer"
        className="w-12 h-auto py-2 rounded-xl flex flex-col items-center justify-center text-base-content/70 hover:bg-base-100 hover:text-info group"
      >
        <img
          src={OUTLOOK_ICON_PATH}
          alt="Outlook"
          className="w-8 h-8 group-hover:scale-110 transition-transform"
        />
        <span className="text-[10px] mt-1 font-medium">Outlook</span>
      </a>
      <div className="h-px bg-base-content/10 w-full my-1" />
      <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
        <button
          className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center transition-all ${isOpen ? 'bg-primary text-primary-content shadow-md' : 'text-base-content/70 hover:bg-base-100 hover:text-base-content'}`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-medium">{t('sidebar.profile')}</span>
        </button>
        <div onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
          <ProfilePopup
            isOpen={isOpen}
            onOpenFeedback={() => {
              setIsOpen(false);
              onOpenFeedback?.();
            }}
            onClose={() => setIsOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}

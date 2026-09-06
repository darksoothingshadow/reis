import { useState, useMemo, useRef, useEffect } from 'react';
import { GraduationCap, X, ChevronDown } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { fuzzyMatch } from '@/utils/searchUtils';
import { useUniversities } from '@/hooks/data/useUniversities';
import type { University } from '@/types/erasmus';

interface UniversityPickerProps {
  alpha2: string | null;
  value: string;
  onChange: (value: string) => void;
  onSelect: (u: University) => void;
  placeholder?: string;
  className?: string;
}

export function UniversityPicker({
  alpha2,
  value,
  onChange,
  onSelect,
  placeholder,
  className,
}: UniversityPickerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const { universities, loading } = useUniversities(alpha2);

  // --- Search Logic ---
  const results = useMemo(() => {
    const s = search.toLowerCase();
    if (!s) return universities.slice(0, 50); // Show top 50 when empty

    return universities
      .filter(
        (u) =>
          fuzzyMatch(s, u.name) || fuzzyMatch(s, u.erasmusCode) || (u.city && fuzzyMatch(s, u.city))
      )
      .slice(0, 50);
  }, [search, universities]);

  // --- Outside Click to Close ---
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as HTMLElement)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayValue = isOpen ? search : value;

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          className={cn(
            'input input-sm input-bordered bg-base-200 w-full text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 pl-8 transition-all pr-8',
            className
          )}
          placeholder={placeholder || t('erasmus.institution')}
          value={displayValue}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
            onChange(e.target.value);
          }}
          onFocus={() => {
            setSearch(value);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsOpen(false);
            if (e.key === 'Enter' && results.length > 0) {
              onSelect(results[0]);
              setIsOpen(false);
            }
          }}
        />

        <GraduationCap
          size={14}
          className={cn(
            'absolute left-2.5 top-1/2 -translate-y-1/2 transition-colors z-10',
            loading ? 'text-[var(--tone-primary)] animate-pulse' : 'text-base-content/70'
          )}
        />

        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
          {isOpen && search ? (
            <button
              onClick={() => {
                setSearch('');
                onChange('');
              }}
              className="p-1 hover:bg-base-200 rounded text-base-content/70"
            >
              <X size={12} />
            </button>
          ) : (
            <ChevronDown size={12} className="text-base-content/20 mr-1" />
          )}
        </div>
      </div>

      {isOpen && alpha2 && (
        <div className="absolute z-[100] mt-1 w-full max-h-[220px] overflow-y-auto bg-base-100 rounded-lg shadow-2xl border border-base-300 animate-in fade-in slide-in-from-top-2 duration-200 scrollbar-thin">
          {loading && universities.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="loading loading-spinner loading-sm text-[var(--tone-primary)]" />
            </div>
          ) : results.length > 0 ? (
            <div className="p-1">
              {results.map((u, i) => (
                <div
                  key={`${u.erasmusCode}-${i}`}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-primary/10 text-left transition-colors group cursor-pointer"
                  onClick={() => {
                    onSelect(u);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-base-content truncate">
                      {u.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--tone-primary)] font-mono font-bold">
                        {u.erasmusCode}
                      </span>
                      {u.city && (
                        <span className="text-[10px] text-base-content/70 italic truncate">
                          {u.city}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-xs text-base-content/70 italic">{t('search.empty')}</div>
          )}
        </div>
      )}
    </div>
  );
}

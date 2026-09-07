import { useState, useMemo, useRef, useEffect } from 'react';
import { Globe, GraduationCap, X } from 'lucide-react';
import { ERASMUS_COUNTRIES } from '@/constants/erasmusCountries';
import { useErasmus } from '@/hooks/data/useErasmus';
import { cn } from '@/components/ui/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { fuzzyMatch, removeDiacritics } from '@/utils/searchUtils';

interface CountryPickerProps {
  value: string;
  onChange: (value: string) => void;
  onViewReports?: (file: string, schoolName: string | null, isPermanent?: boolean) => void;
  placeholder?: string;
  className?: string;
}

export function CountryPicker({
  value,
  onChange,
  onViewReports,
  placeholder,
  className,
}: CountryPickerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const { setCountry, countryFile, reports } = useErasmus();

  // --- Auto-Country Detection & Sync ---
  useEffect(() => {
    const val = value?.trim();
    if (!val || val.length < 2) return;

    const normalizedVal = removeDiacritics(val.toLowerCase());

    const match = ERASMUS_COUNTRIES.find(
      (c) =>
        removeDiacritics(c.en.toLowerCase()) === normalizedVal ||
        removeDiacritics(c.cs.toLowerCase()) === normalizedVal ||
        c.alpha2.toLowerCase() === normalizedVal
    );

    if (match && match.file && match.file !== countryFile) {
      setCountry(match.file);
    }
  }, [value, countryFile, setCountry]);

  // --- Search Logic with Fuzzy Tolerance ---
  const results = useMemo(() => {
    const s = search.toLowerCase();
    if (!s) return ERASMUS_COUNTRIES;

    return ERASMUS_COUNTRIES.filter(
      (c) => fuzzyMatch(s, c.en) || fuzzyMatch(s, c.cs) || fuzzyMatch(s, c.alpha2)
    );
  }, [search]);

  // --- Outside Click to Close ---
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (containerRef.current?.contains(target)) return;

      // Do not close if the user is interacting with the Reports Drawer (fixed/dialog)
      if (target.closest('[role="dialog"]') || target.closest('.fixed')) {
        return;
      }

      setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedCountry = ERASMUS_COUNTRIES.find((c) => c.en === value || c.cs === value);
  const lang = t('lang') === 'en' ? 'en' : 'cs';
  const displayValue = isOpen
    ? search
    : selectedCountry
      ? selectedCountry[lang as 'en' | 'cs']
      : value;
  const hasReports = selectedCountry?.file && reports.length > 0;

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          className={cn(
            'input input-sm input-bordered bg-base-200 w-full text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 pl-8 transition-all',
            hasReports ? 'pr-14' : 'pr-8',
            className
          )}
          placeholder={placeholder}
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
              onChange(results[0].en);
              setIsOpen(false);
            }
          }}
        />

        {/* Left Icon: Globe */}
        <Globe
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/70 pointer-events-none z-10"
        />

        {/* Right Action: Clear or View Reports */}
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
          {isOpen && search && (
            <button
              onClick={() => {
                setSearch('');
                onChange('');
              }}
              className="p-1 hover:bg-base-200 rounded text-base-content/70"
            >
              <X size={12} />
            </button>
          )}

          {hasReports && !isOpen && onViewReports && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewReports(selectedCountry.file, null);
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-info/10 hover:bg-info/20 text-info border border-info/20 transition-all group"
              title={`${reports.length} ${t('erasmus.reports')}`}
            >
              <span className="text-[10px] font-bold leading-none">{reports.length}</span>
              <GraduationCap size={10} className="group-hover:scale-110 transition-transform" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && (
        <div className="absolute z-[100] mt-1 w-full max-h-[220px] overflow-y-auto bg-base-100 rounded-lg shadow-2xl border border-base-300 animate-in fade-in slide-in-from-top-2 duration-200 scrollbar-thin">
          {results.length > 0 ? (
            <div className="p-1">
              {results.map((c) => (
                <div
                  key={c.id}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-primary/10 text-left transition-colors group cursor-pointer"
                  onClick={() => {
                    onChange(c.en);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-base-content">{c.cs}</span>
                    <span className="text-[10px] text-base-content/70 uppercase tracking-tight">
                      {c.en}
                    </span>
                  </div>

                  {/* Peeking Badge: Allows opening reports without selecting country */}
                  {c.file && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Open reports (temporary peek)
                        if (onViewReports) onViewReports(c.file!, null);
                      }}
                      className="flex items-center gap-1 px-1.5 py-1 rounded bg-info/5 hover:bg-info/20 text-info border border-transparent hover:border-info/20 transition-all opacity-40 group-hover:opacity-100"
                    >
                      <GraduationCap size={11} />
                      <span className="text-[9px] font-bold uppercase tracking-wide">
                        {t('erasmus.insight')}
                      </span>
                    </button>
                  )}
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

import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useRef, useEffect } from 'react';
import { injectUserParams } from '../data/pagesData';
import { useSearch, type SearchResult } from '../hooks/ui/useSearch';
import { SearchResultItem } from './Search/SearchResultItem';

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  onOpenExamDrawer?: () => void;
  onSelect?: (result: SearchResult) => void;
}

export function SearchBar({ placeholder = "Najdi cokoliv – předměty, učitele, odkazy (Ctrl + K)", onSearch, onOpenExamDrawer, onSelect }: SearchBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    query,
    setQuery,
    isOpen,
    setIsOpen,
    selectedIndex,
    setSelectedIndex,
    displayResults,
    isLoading,
    isMac,
    handleSelect,
    handleKeyDown
  } = useSearch(onOpenExamDrawer, (res) => {
    if (res.link && !['zapisy-zkousky'].includes(res.id)) {
      window.open(injectUserParams(res.link), '_blank');
    }
    onSelect?.(res);
  }, onSearch);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsOpen]);

  // NOTE: Ctrl+K is now handled by CommandPalette, not SearchBar
  // NOTE: Dropdown only opens when typing, not on focus

  return (
    <div className="flex-1 flex items-center px-4">
      <div className="flex-1 max-w-3xl mx-auto flex items-center gap-2">
        <div
          ref={containerRef}
          className="relative flex-1 z-50"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <div className={`relative flex items-center w-full max-w-3xl bg-base-100 rounded-xl border shadow-sm transition-all duration-200 ${isOpen ? 'border-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_15%,transparent)]' : 'border-base-300 hover:border-base-content/30'}`}>
            <div className="flex-1 flex items-center h-12 px-4">
              <Search className={`w-5 h-5 mr-3 transition-colors ${isOpen ? 'text-base-content' : 'text-base-content/50'}`} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  const value = e.target.value;
                  setQuery(value);
                  setIsOpen(value.trim() !== '');
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full bg-transparent text-sm text-base-content placeholder-base-content/50 focus:outline-none"
                aria-label="Vyhledávání"
                aria-autocomplete="list"
                aria-controls="search-results"
              />
              {query ? (
                <button
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  className="p-1 hover:bg-base-200 rounded-full transition-colors"
                  aria-label="Vymazat"
                >
                  <X className="w-4 h-4 text-base-content/50" />
                </button>
              ) : (
                !isOpen && (
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 text-xs text-base-content/50 bg-base-200 border border-base-300 rounded px-1.5 py-0.5 font-sans">
                    {isMac ? (
                      <><span className="text-[10px]">⌘</span>K</>
                    ) : (
                      <><span className="text-[10px]">⌃</span>K</>
                    )}
                  </kbd>
                )
              )}
            </div>
          </div>

          {isOpen && (
            <div
              id="search-results"
              role="listbox"
              className="absolute top-full left-0 right-0 bg-base-100 border border-t-0 border-base-300 rounded-b-lg shadow-lg overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="h-px w-full bg-base-300" />
              <div className="px-4 py-2 text-xs font-semibold text-base-content/50 uppercase tracking-wider mt-1 flex justify-between items-center">
                <span>{query ? 'Výsledky' : 'Nedávná vyhledávání'}</span>
                {isLoading && displayResults.length > 0 && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-base-content/50"></div>}
              </div>
              <div className="max-h-[min(400px,50vh)] overflow-y-auto pb-2">
                {displayResults.length > 0 ? (
                  displayResults.map((result, index) => (
                    <SearchResultItem
                      key={result.id}
                      result={result}
                      isRecent={query === ''}
                      isSelected={selectedIndex === index}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={() => {
                        handleSelect(result);
                      }}
                    />
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-base-content/50">
                    {isLoading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-base-content/50"></div>
                        <span>Načítání výsledků...</span>
                      </div>
                    ) : query.trim() === '' ? (
                      <span>Začněte psát pro vyhledávání...</span>
                    ) : (
                      'Nic nenalezeno'
                    )}
                  </div>
                )}
              </div>
              <div className="border-t border-base-300 bg-base-200 px-4 py-2">
                <div className="flex items-center gap-3 text-xs text-base-content/50">
                  <div className="flex items-center gap-1">
                    <kbd className="w-5 h-5 border border-base-300 rounded flex items-center justify-center bg-base-100 text-[10px]">
                      <ChevronUp className="w-3 h-3" />
                    </kbd>
                    <kbd className="w-5 h-5 border border-base-300 rounded flex items-center justify-center bg-base-100 text-[10px]">
                      <ChevronDown className="w-3 h-3" />
                    </kbd>
                    <span className="ml-1">Vybrat</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="h-5 px-1.5 border border-base-300 rounded flex items-center justify-center bg-base-100 min-w-[20px] text-[10px]">
                      ↵
                    </kbd>
                    <span className="ml-1">Otevřít</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="h-5 px-1.5 border border-base-300 rounded flex items-center justify-center bg-base-100 text-[10px]">
                      Esc
                    </kbd>
                    <span className="ml-1">Zavřít</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type { SearchResult };
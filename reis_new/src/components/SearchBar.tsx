import { Search, X, ChevronUp, ChevronDown, Clock, User, FileText } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
}

interface SearchResult {
  id: string;
  title: string;
  type: 'person' | 'page';
  detail?: string;
}

const mockSearchData: SearchResult[] = [
  { id: '1', title: 'Jiří Rybička', type: 'person', detail: 'Učitel • Katedra informatiky' },
  { id: '2', title: 'Jana Nováková', type: 'person', detail: 'Učitel • Katedra ekonomie' },
  { id: '3', title: 'Studijní plány', type: 'page', detail: 'Sekce O studiu' },
  { id: '4', title: 'Rozvrh hodin', type: 'page', detail: 'Osobní rozvrh' },
  { id: '5', title: 'Martin Svoboda', type: 'person', detail: 'Student • 3. ročník' },
  { id: '6', title: 'Přihlášky ke zkouškám', type: 'page', detail: 'Zkouškové období' },
];

const recentSearches: SearchResult[] = [
  { id: 'r1', title: 'Studijní plány', type: 'page', detail: 'Hledáno před 10 min' },
  { id: 'r2', title: 'Jiří Rybička', type: 'person', detail: 'Hledáno včera' },
  { id: 'r3', title: 'Rozvrh hodin', type: 'page', detail: 'Hledáno minulý týden' },
];

export function SearchBar({ placeholder = "Prohledej reIS", onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayResults = query.trim() === '' ? recentSearches : filteredResults;

  // Filter results based on query
  useEffect(() => {
    if (query.trim() === '') {
      setFilteredResults([]);
      setSelectedIndex(-1);
      return;
    }

    const filtered = mockSearchData.filter(item =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.detail?.toLowerCase().includes(query.toLowerCase())
    );

    setFilteredResults(filtered);
    setSelectedIndex(-1);
  }, [query]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Ctrl+K handler
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleFocus = () => setIsOpen(true);

  const handleSelect = (result: SearchResult) => {
    console.log('Selected:', result);
    // TODO: Navigate to result or trigger onSearch callback
    if (onSearch) {
      onSearch(result.title);
    }
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' && query.trim() !== '') {
        setIsOpen(true);
      }
      return;
    }

    const resultsCount = displayResults.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % resultsCount);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev <= 0 ? resultsCount - 1 : prev - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < resultsCount) {
          handleSelect(displayResults[selectedIndex]);
        } else if (resultsCount > 0) {
          handleSelect(displayResults[0]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
        break;
    }
  };

  return (
    <div className="flex-1 flex items-center px-4">

      <div className="flex-1 max-w-2xl mx-auto flex items-center gap-2">
        {/* MAIN CONTAINER */}
        <div
          ref={containerRef}
          className="relative flex-1 z-50"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          {/* THE "SHAPE SHIFTER" */}
          <div className={`
            flex items-center w-full bg-white transition-all duration-200
            ${isOpen
              ? 'rounded-t-lg rounded-b-none shadow-lg'
              : 'shadow-sm'
            }
          `}>

            {/* Input Area */}
            <div className="flex-1 flex items-center h-10 px-3 border border-gray-300 rounded-md">
              <Search className={`w-4 h-4 mr-3 transition-colors ${isOpen ? 'text-gray-800' : 'text-gray-500'}`} />

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-500 focus:outline-none"
                aria-label="Vyhledávání"
                aria-autocomplete="list"
                aria-controls="search-results"
              />

              {/* Right side icons */}
              {query ? (
                <button
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Vymazat"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              ) : (
                !isOpen && (
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 text-xs text-gray-500 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 font-sans">
                    <span className="text-[10px]">⌃</span>K
                  </kbd>
                )
              )}
            </div>
          </div>

          {/* THE DROPDOWN */}
          {isOpen && (
            <div
              id="search-results"
              role="listbox"
              className="absolute top-full left-0 right-0 bg-white border border-t-0 border-gray-300 rounded-b-lg shadow-lg overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200"
            >

              {/* Thin Line Separator */}
              <div className="h-px w-full bg-gray-200" />

              {/* Section Title */}
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">
                {query ? 'Výsledky' : 'Nedávná vyhledávání'}
              </div>

              {/* Results List */}
              <div className="max-h-[min(400px,50vh)] overflow-y-auto pb-2">
                {displayResults.length > 0 ? (
                  displayResults.map((result, index) => (
                    <button
                      key={result.id}
                      role="option"
                      aria-selected={selectedIndex === index}
                      onClick={() => handleSelect(result)}
                      className={`w-full px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors text-left ${selectedIndex === index ? 'bg-[#8DC843]/10' : 'hover:bg-gray-50'
                        }`}
                    >
                      {/* Left Icon Container */}
                      <div className="flex-shrink-0">
                        {query === '' ? (
                          <Clock className="w-4 h-4 text-gray-400" />
                        ) : result.type === 'person' ? (
                          <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-purple-600" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm text-gray-800 truncate">
                            {result.title}
                          </span>
                          {query !== '' && (
                            <>
                              <span className="text-gray-400 flex-shrink-0">•</span>
                              <span className="text-xs text-gray-500 flex-shrink-0">
                                {result.type === 'person' ? 'Osoba' : 'Stránka'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right Icon - Type Indicator */}
                      {query !== '' && (
                        <div className="flex-shrink-0 ml-2">
                          {result.type === 'person' ? (
                            <User className="w-4 h-4 text-gray-400" />
                          ) : (
                            <FileText className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    Nic nenalezeno
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-2">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <kbd className="w-5 h-5 border border-gray-300 rounded flex items-center justify-center bg-white text-[10px]">
                      <ChevronUp className="w-3 h-3" />
                    </kbd>
                    <kbd className="w-5 h-5 border border-gray-300 rounded flex items-center justify-center bg-white text-[10px]">
                      <ChevronDown className="w-3 h-3" />
                    </kbd>
                    <span className="ml-1">Vybrat</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="h-5 px-1.5 border border-gray-300 rounded flex items-center justify-center bg-white min-w-[20px] text-[10px]">
                      ↵
                    </kbd>
                    <span className="ml-1">Otevřít</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="h-5 px-1.5 border border-gray-300 rounded flex items-center justify-center bg-white text-[10px]">
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
import { Search, X, ChevronUp, ChevronDown, Clock, FileText, GraduationCap, Briefcase } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { searchPeople } from '../api/search';
import { pagesData, BASE_URL } from '../data/pagesData';
import type { PageItem, PageCategory } from '../data/pagesData';
import { fuzzyIncludes } from '../utils/searchUtils';

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
}

interface SearchResult {
  id: string;
  title: string;
  type: 'person' | 'page';
  detail?: string;
  link?: string;
  personType?: 'student' | 'teacher' | 'staff' | 'unknown';
  category?: string;
}

// Removed mock data
const MAX_RECENT_SEARCHES = 5;
const STORAGE_KEY = 'reis_recent_searches';

export function SearchBar({ placeholder = "Prohledej reIS", onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);

  // Load recent searches on mount (from sessionStorage for better privacy)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load recent searches', e);
    }
  }, []);

  const saveToHistory = (result: SearchResult) => {
    const newItem = { ...result, detail: 'Nedávno hledáno' };
    setRecentSearches(prev => {
      const filtered = prev.filter(item => item.title !== result.title);
      const updated = [newItem, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const displayResults = query.trim() === '' ? recentSearches : filteredResults;

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 3) {
      setFilteredResults([]);
      setSelectedIndex(-1);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(async () => {
      try {
        const searchQuery = query.toLowerCase();

        // Search people
        const people = await searchPeople(query);
        const personResults: SearchResult[] = people.map((p, index) => ({
          id: p.id || `unknown-${index}`,
          title: p.name,
          type: 'person' as const,
          detail: p.type === 'student' ? 'Student' : p.type === 'teacher' ? 'Vyučující' : 'Zaměstnanec',
          link: p.link,
          personType: p.type
        }));

        // Search pages
        const pageResults: SearchResult[] = [];
        pagesData.forEach((category: PageCategory) => {
          category.items.forEach((page: PageItem) => {
            // Match on label or keywords using fuzzy matching
            const matchesLabel = fuzzyIncludes(page.label, searchQuery);
            const matchesKeyword = page.keywords.some(keyword =>
              fuzzyIncludes(keyword, searchQuery)
            );

            if (matchesLabel || matchesKeyword) {
              pageResults.push({
                id: page.id,
                title: page.label,
                type: 'page' as const,
                detail: category.label,
                link: page.path.startsWith('http') ? page.path : `${BASE_URL}${page.path}`,
                category: category.label
              });
            }
          });
        });

        // Sort person results: Teachers first, then Students, then Staff
        personResults.sort((a, b) => {
          const getPriority = (type?: string) => {
            if (type === 'teacher') return 0;
            if (type === 'student') return 1;
            if (type === 'staff') return 2;
            return 3;
          };
          return getPriority(a.personType) - getPriority(b.personType);
        });

        // Combine results: pages first, then people
        const combinedResults = [...pageResults, ...personResults];
        setFilteredResults(combinedResults);
      } catch (error) {
        console.error("Search failed", error);
        setFilteredResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
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
    saveToHistory(result);

    // For keyboard navigation, open the link programmatically
    if (result.link) {
      window.open(result.link, '_blank');
    }
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
          <div className={`relative flex items-center w-full max-w-2xl bg-white rounded-xl border border-gray-200 shadow-sm transition-all duration-200 ${isOpen ? 'ring-2 ring-mendelu-green/20 border-mendelu-green' : 'hover:border-gray-300'}`}>

            {/* Input Area */}
            <div className="flex-1 flex items-center h-10 px-3 border border-gray-300 border-solid rounded-md">
              <Search className={`w-4 h-4 mr-3 transition-colors ${isOpen ? 'text-gray-800' : 'text-gray-500'}`} />

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsOpen(true);
                }}
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
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1 flex justify-between items-center">
                <span>{query ? 'Výsledky' : 'Nedávná vyhledávání'}</span>
                {isLoading && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></div>}
              </div>

              {/* Results List */}
              <div className="max-h-[min(400px,50vh)] overflow-y-auto pb-2">
                {displayResults.length > 0 ? (
                  displayResults.map((result, index) => (
                    <div
                      key={result.id}
                      role="option"
                      aria-selected={selectedIndex === index}
                      onMouseEnter={() => setSelectedIndex(index)}

                      // CHANGE STARTS HERE
                      onMouseDown={(e) => {
                        // 1. Prevent the input from losing focus
                        e.preventDefault();
                        // 2. Use the shared handler so logic is identical to pressing 'Enter'
                        handleSelect(result);
                      }}
                      // Remove the old onClick handler entirely
                      // CHANGE ENDS HERE

                      className={`w-full px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors text-left ${selectedIndex === index ? 'bg-[#8DC843]/10' : 'hover:bg-gray-50'
                        }`}
                    >
                      {/* Left Icon Container */}
                      <div className="flex-shrink-0">
                        {query === '' ? (
                          <Clock className="w-4 h-4 text-gray-400" />
                        ) : result.type === 'page' ? (
                          <div className="w-6 h-6 rounded bg-green-100 flex items-center justify-center">
                            <FileText className="w-3.5 h-3.5 text-green-600" />
                          </div>
                        ) : result.personType === 'student' ? (
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                            <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                        ) : result.personType === 'teacher' ? (
                          <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                            <Briefcase className="w-3.5 h-3.5 text-purple-600" />
                          </div>
                        ) : result.personType === 'staff' ? (
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                            <Briefcase className="w-3.5 h-3.5 text-gray-600" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center">
                            <FileText className="w-3.5 h-3.5 text-gray-600" />
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
                                {result.detail}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right Icon - Type Indicator */}
                      {query !== '' && (
                        <div className="flex-shrink-0 ml-2">
                          {/* Optional: Add arrow-up-right or similar to indicate external link */}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    {isLoading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500"></div>
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
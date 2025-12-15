import { Search, X, ChevronUp, ChevronDown, Clock, FileText, GraduationCap, Briefcase, BookOpen } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { searchGlobal } from '../api/search';
import { pagesData, injectUserParams } from '../data/pagesData';
import type { PageItem, PageCategory } from '../data/pagesData';
import { fuzzyIncludes } from '../utils/searchUtils';

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  onOpenExamDrawer?: () => void;
}

interface SearchResult {
  id: string;
  title: string;
  type: 'person' | 'page' | 'subject';
  detail?: string;
  link?: string;
  personType?: 'student' | 'teacher' | 'staff' | 'unknown';
  category?: string;
  subjectCode?: string;
}

// Removed mock data
const MAX_RECENT_SEARCHES = 5;
const STORAGE_KEY = 'reis_recent_searches';

export function SearchBar({ placeholder = "Prohledej reIS", onSearch, onOpenExamDrawer }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect Mac vs Windows/Linux for keyboard shortcut display
  const isMac = useMemo(() => {
    return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  }, []);

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

        // Search people and subjects using global search
        const { people, subjects } = await searchGlobal(query);
        
        const personResults: SearchResult[] = people.map((p, index) => ({
          id: p.id || `unknown-${index}`,
          title: p.name,
          type: 'person' as const,
          detail: p.type === 'student' ? 'Student' : p.type === 'teacher' ? 'Vyučující' : 'Zaměstnanec',
          link: p.link,
          personType: p.type
        }));

        const subjectResults: SearchResult[] = subjects.map((s) => {
          // Build detail string: code · semester · faculty
          const parts = [s.code];
          if (s.semester) parts.push(s.semester);
          if (s.faculty !== 'N/A') parts.push(s.faculty);
          
          return {
            id: `subject-${s.id}`,
            title: s.name,
            type: 'subject' as const,
            detail: parts.join(' · '),
            link: s.link,
            subjectCode: s.code
          };
        });

        // Search pages
        const pageResults: SearchResult[] = [];
        pagesData.forEach((category: PageCategory) => {
          category.children.forEach((page: PageItem) => {
            // Match on label using fuzzy matching
            const matchesLabel = fuzzyIncludes(page.label, searchQuery);

            if (matchesLabel) {
              pageResults.push({
                id: page.id,
                title: page.label,
                type: 'page' as const,
                detail: category.label,
                link: page.href,
                category: category.label
              });
            }
          });
        });

        // Relevance scoring - higher is better
        const getRelevanceScore = (result: SearchResult): number => {
          const title = result.title.toLowerCase();
          const code = result.subjectCode?.toLowerCase() ?? '';
          
          // Type-based base score (subjects > pages > people)
          let baseScore = 0;
          if (result.type === 'subject') baseScore = 1000;
          else if (result.type === 'page') baseScore = 500;
          else baseScore = 100; // person
          
          // Bonus for match quality
          if (title === searchQuery) return baseScore + 100; // Exact match
          if (title.startsWith(searchQuery)) return baseScore + 90; // Prefix match on title
          if (code === searchQuery) return baseScore + 85; // Exact code match
          if (code.startsWith(searchQuery)) return baseScore + 80; // Prefix match on code
          if (title.includes(` ${searchQuery}`)) return baseScore + 60; // Word boundary
          if (title.includes(searchQuery) || code.includes(searchQuery)) return baseScore + 40; // Contains
          return baseScore + 10; // Fuzzy/partial
        };

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

        // Combine all results and sort by relevance, with title as tiebreaker
        const allResults = [...subjectResults, ...pageResults, ...personResults];
        allResults.sort((a, b) => {
          const scoreA = getRelevanceScore(a);
          const scoreB = getRelevanceScore(b);
          if (scoreB !== scoreA) return scoreB - scoreA;
          return a.title.localeCompare(b.title); // Alphabetical tiebreaker
        });

        setFilteredResults(allResults);
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

    // Check for exam registration pages
    if (['zapisy-zkousky', 'prihlasovani-zkouskam'].includes(result.id)) {
      if (onOpenExamDrawer) {
        onOpenExamDrawer();
        setQuery('');
        setIsOpen(false);
        setSelectedIndex(-1);
        return;
      }
    }

    // For keyboard navigation, open the link programmatically
    if (result.link) {
      window.open(injectUserParams(result.link), '_blank');
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

      <div className="flex-1 max-w-3xl mx-auto flex items-center gap-2">
        {/* MAIN CONTAINER */}
        <div
          ref={containerRef}
          className="relative flex-1 z-50"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          {/* THE "SHAPE SHIFTER" */}
          <div className={`relative flex items-center w-full max-w-3xl bg-base-100 rounded-xl border shadow-sm transition-all duration-200 ${isOpen ? 'border-primary shadow-[0_0_0_3px_rgba(121,190,21,0.15)]' : 'border-base-300 hover:border-base-content/30'}`}>

            {/* Input Area - no border, parent owns visual boundary */}
            <div className="flex-1 flex items-center h-12 px-4">
              <Search className={`w-5 h-5 mr-3 transition-colors ${isOpen ? 'text-base-content' : 'text-base-content/50'}`} />

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
                className="w-full bg-transparent text-sm text-base-content placeholder-base-content/50 focus:outline-none"
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

          {/* THE DROPDOWN */}
          {isOpen && (
            <div
              id="search-results"
              role="listbox"
              className="absolute top-full left-0 right-0 bg-base-100 border border-t-0 border-base-300 rounded-b-lg shadow-lg overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200"
            >

              {/* Thin Line Separator */}
              <div className="h-px w-full bg-base-300" />

              {/* Section Title */}
              <div className="px-4 py-2 text-xs font-semibold text-base-content/50 uppercase tracking-wider mt-1 flex justify-between items-center">
                <span>{query ? 'Výsledky' : 'Nedávná vyhledávání'}</span>
                {isLoading && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-base-content/50"></div>}
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

                      className={`w-full px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors text-left ${selectedIndex === index ? 'bg-primary/10' : 'hover:bg-base-200'
                        }`}
                    >
                      {/* Left Icon Container */}
                      <div className="flex-shrink-0">
                        {query === '' ? (
                          <Clock className="w-4 h-4 text-base-content/40" />
                        ) : result.type === 'page' ? (
                          <div className="w-6 h-6 rounded bg-success/20 flex items-center justify-center">
                            <FileText className="w-3.5 h-3.5 text-success" />
                          </div>
                        ) : result.type === 'subject' ? (
                          <div className="w-6 h-6 rounded bg-violet-500/20 flex items-center justify-center">
                            <BookOpen className="w-3.5 h-3.5 text-violet-600" />
                          </div>
                        ) : result.personType === 'student' ? (
                          <div className="w-6 h-6 rounded-full bg-info/20 flex items-center justify-center">
                            <GraduationCap className="w-3.5 h-3.5 text-info" />
                          </div>
                        ) : result.personType === 'teacher' ? (
                          <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center">
                            <Briefcase className="w-3.5 h-3.5 text-secondary" />
                          </div>
                        ) : result.personType === 'staff' ? (
                          <div className="w-6 h-6 rounded-full bg-base-200 flex items-center justify-center">
                            <Briefcase className="w-3.5 h-3.5 text-base-content/60" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded bg-base-200 flex items-center justify-center">
                            <FileText className="w-3.5 h-3.5 text-base-content/60" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm text-base-content truncate">
                            {result.title}
                          </span>
                          {query !== '' && (
                            <>
                              <span className="text-base-content/40 flex-shrink-0">•</span>
                              <span className="text-xs text-base-content/50 flex-shrink-0">
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

              {/* Footer */}
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
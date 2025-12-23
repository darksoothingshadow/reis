/**
 * Command Palette Component
 * 
 * A quick-access modal for searching subjects, teachers, and navigating actions.
 * Triggered with Ctrl+K / Cmd+K.
 */

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Book, User, Zap, X, Loader2, FileText } from 'lucide-react';
import { useCommandPalette } from '../../hooks/useCommandPalette';
import type { CommandItem } from '../../hooks/useCommandPalette';

interface CommandPaletteProps {
    items: CommandItem[];
}

export default function CommandPalette({ items }: CommandPaletteProps) {
    const {
        isOpen,
        close,
        query,
        setQuery,
        results,
        selectedIndex,
        setSelectedIndex,
        isLoading,
    } = useCommandPalette(items);

    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // External Trigger Listener (from Onboarding)
    useEffect(() => {
        const handleOpen = () => open();
        document.addEventListener('reis-open-command-palette', handleOpen);
        return () => document.removeEventListener('reis-open-command-palette', handleOpen);
    }, [open]);

    const getIcon = (type: CommandItem['type']) => {
        switch (type) {
            case 'subject':
                return <Book className="w-4 h-4" />;
            case 'person':
                return <User className="w-4 h-4" />;
            case 'page':
                return <FileText className="w-4 h-4" />;
            case 'action':
                return <Zap className="w-4 h-4" />;
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10050]"
                        onClick={close}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg bg-base-100 rounded-xl shadow-2xl border border-base-300 z-[10050] overflow-hidden"
                    >
                        {/* Search Input */}
                        <div className="flex items-center gap-3 p-4 border-b border-base-300">
                            <Search className="w-5 h-5 text-base-content/50" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setQuery(val);
                                    if (val.trim() === '') {
                                        close();
                                    }
                                }}
                                placeholder="Hledat předměty, učitele, akce..."
                                className="flex-1 bg-transparent outline-none text-base-content placeholder:text-base-content/50"
                            />
                            <button
                                onClick={close}
                                className="p-1 hover:bg-base-200 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4 text-base-content/50" />
                            </button>
                        </div>

                        {/* Results */}
                        <div className="max-h-80 overflow-y-auto p-2">
                            {query.trim() === '' ? (
                                <div className="p-4 text-center text-base-content/50">
                                    Začněte psát pro vyhledávání...
                                </div>
                            ) : isLoading ? (
                                <div className="p-4 flex items-center justify-center text-base-content/50">
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                    Hledám...
                                </div>
                            ) : results.length === 0 ? (
                                <div className="p-4 text-center text-base-content/50">
                                    Žádné výsledky
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {results.map((item, index) => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                item.action();
                                                close();
                                            }}
                                            onMouseEnter={() => setSelectedIndex(index)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                                                index === selectedIndex
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'hover:bg-base-200'
                                            }`}
                                        >
                                            <span className={`${index === selectedIndex ? 'text-primary' : 'text-base-content/50'}`}>
                                                {getIcon(item.type)}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">{item.title}</div>
                                                {item.subtitle && (
                                                    <div className="text-sm text-base-content/50 truncate">
                                                        {item.subtitle}
                                                    </div>
                                                )}
                                            </div>
                                            {index === selectedIndex && (
                                                <kbd className="px-2 py-1 text-xs bg-base-200 rounded">
                                                    Enter
                                                </kbd>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-4 py-2 border-t border-base-300 text-xs text-base-content/50">
                            <span>
                                <kbd className="px-1.5 py-0.5 bg-base-200 rounded mr-1">↑↓</kbd>
                                pro navigaci
                            </span>
                            <span>
                                <kbd className="px-1.5 py-0.5 bg-base-200 rounded mr-1">Esc</kbd>
                                pro zavření
                            </span>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

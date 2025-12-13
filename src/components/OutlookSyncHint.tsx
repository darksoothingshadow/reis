import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, X, ChevronRight } from 'lucide-react';

const OUTLOOK_HINT_STORAGE_KEY = 'reis_outlook_hint_shown';
const OUTLOOK_HINT_NAV_THRESHOLD = 2;

interface OutlookSyncHintProps {
    /** Number of week navigations this session */
    navigationCount: number;
    /** Whether Outlook sync is currently enabled */
    isSyncEnabled: boolean | null;
    /** Called when user clicks "Nastavit" - should open settings popup */
    onSetup: () => void;
}

/**
 * Spotlight tooltip that teaches users about Outlook sync.
 * Appears after 2 week navigations if sync is not enabled.
 */
export function OutlookSyncHint({ navigationCount, isSyncEnabled, onSetup }: OutlookSyncHintProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [hasBeenDismissed, setHasBeenDismissed] = useState(false);

    useEffect(() => {
        // Check if already seen
        const hasSeenHint = localStorage.getItem(OUTLOOK_HINT_STORAGE_KEY);
        if (hasSeenHint) {
            setHasBeenDismissed(true);
            return;
        }

        // Show conditions:
        // 1. Navigation count >= threshold
        // 2. Sync is NOT enabled (false, not null/loading)
        // 3. Not dismissed this session
        const shouldShow = 
            navigationCount >= OUTLOOK_HINT_NAV_THRESHOLD &&
            isSyncEnabled === false &&
            !hasBeenDismissed;

        if (shouldShow && !isVisible) {
            // Delay slightly for smoother appearance
            const timer = setTimeout(() => setIsVisible(true), 500);
            return () => clearTimeout(timer);
        }
    }, [navigationCount, isSyncEnabled, hasBeenDismissed, isVisible]);

    // Auto-dismiss after 12 seconds
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                handleDismiss();
            }, 12000);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    // Hide if sync gets enabled
    useEffect(() => {
        if (isSyncEnabled === true && isVisible) {
            setIsVisible(false);
        }
    }, [isSyncEnabled, isVisible]);

    const handleDismiss = () => {
        setIsVisible(false);
        setHasBeenDismissed(true);
        localStorage.setItem(OUTLOOK_HINT_STORAGE_KEY, 'true');
    };

    const handleSetup = () => {
        handleDismiss();
        onSetup();
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <>
                    {/* Semi-transparent backdrop - only covers calendar area, not header navigation */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 top-14 bg-black/20 z-[100]"
                        onClick={handleDismiss}
                    />
                    
                    {/* Spotlight tooltip - positioned near sidebar Profil button */}
                    <motion.div
                        initial={{ opacity: 0, x: -20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -20, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="fixed left-24 bottom-20 z-[101] w-80"
                    >
                        {/* Arrow pointing to sidebar */}
                        <div className="absolute -left-2 bottom-8 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-white" />
                        
                        {/* Card */}
                        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 flex items-center gap-3">
                                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                    <Calendar className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-white font-semibold">Synchronizace s Outlookem</span>
                                <button 
                                    onClick={handleDismiss}
                                    className="ml-auto p-1 hover:bg-white/20 rounded-lg transition-colors"
                                >
                                    <X className="w-4 h-4 text-white/80" />
                                </button>
                            </div>
                            
                            {/* Body */}
                            <div className="p-4">
                                <p className="text-gray-600 text-sm leading-relaxed mb-4">
                                    Přidej si přednášky a zkoušky automaticky do svého Outlook kalendáře. 
                                    Už nikdy nezmeškáš důležitou hodinu!
                                </p>
                                
                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSetup}
                                        className="flex-1 btn btn-primary btn-sm gap-1 bg-emerald-600 hover:bg-emerald-700 border-emerald-600 hover:border-emerald-700"
                                    >
                                        Nastavit
                                        <ChevronRight size={16} />
                                    </button>
                                    <button
                                        onClick={handleDismiss}
                                        className="btn btn-ghost btn-sm text-gray-500"
                                    >
                                        Později
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

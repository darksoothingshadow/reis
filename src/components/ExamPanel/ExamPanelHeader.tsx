/**
 * ExamPanel Header Component
 */

import { X, ExternalLink } from 'lucide-react';
import { formatRelativeTime } from './utils';

interface ExamPanelHeaderProps {
    lastSync: number | null;
    onClose: () => void;
}

export function ExamPanelHeader({ lastSync, onClose }: ExamPanelHeaderProps) {
    return (
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-base-100">
            <div className="flex flex-col">
                <h2 className="text-xl font-semibold text-base-content">Zápisy na zkoušky</h2>
                <span className="text-xs text-base-content/50">
                    Aktualizováno: {formatRelativeTime(lastSync)}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <a
                    href="https://is.mendelu.cz/auth/student/terminy_seznam.pl?lang=cz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm gap-1"
                >
                    <ExternalLink size={14} />
                    IS MENDELU
                </a>
                <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm">
                    <X size={18} />
                </button>
            </div>
        </div>
    );
}

/**
 * Auto-booking Banner Component
 */
interface AutoBookingBannerProps {
    isActive: boolean;
    onCancel: () => void;
}

export function AutoBookingBanner({ isActive, onCancel }: AutoBookingBannerProps) {
    if (!isActive) return null;

    return (
        <div className="flex items-center gap-3 px-6 py-2 bg-warning/10 border-b border-warning/20">
            <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
            <span className="text-sm text-warning font-medium">
                Auto-rezervace aktivní. Nezavírejte tuto stránku!
            </span>
            <button
                onClick={onCancel}
                className="btn btn-ghost btn-xs ml-auto"
            >
                Zrušit
            </button>
        </div>
    );
}

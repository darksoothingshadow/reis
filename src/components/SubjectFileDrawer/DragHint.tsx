/**
 * Drag Hint Animation Component
 * 
 * Shows a first-use hint for drag selection.
 */

import { MousePointer2 } from 'lucide-react';

interface DragHintProps {
    show: boolean;
}

export function DragHint({ show }: DragHintProps) {
    if (!show) return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
            {/* Animated lasso selection */}
            <div 
                className="absolute border-2 border-emerald-500 bg-emerald-500/15 rounded-sm"
                style={{
                    animation: 'dragHintLasso 2s ease-in-out infinite',
                    top: '80px',
                    left: '40px',
                    width: '0px',
                    height: '0px',
                }}
            />
            {/* Tooltip */}
            <div 
                className="absolute bg-neutral text-neutral-content text-sm px-3 py-2 rounded-lg shadow-lg flex items-center gap-2"
                style={{
                    animation: 'dragHintFade 4s ease-in-out forwards',
                    top: '200px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                }}
            >
                <MousePointer2 size={16} className="text-primary" />
                Tažením vyberete více souborů
            </div>

            <style>{`
                @keyframes dragHintLasso {
                    0% { width: 0; height: 0; opacity: 0; }
                    10% { opacity: 1; }
                    50% { width: 200px; height: 120px; opacity: 1; }
                    80% { width: 200px; height: 120px; opacity: 0.5; }
                    100% { width: 200px; height: 120px; opacity: 0; }
                }
                @keyframes dragHintFade {
                    0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
                    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    85% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                }
            `}</style>
        </div>
    );
}

/**
 * Selection Box Overlay Component
 */
interface SelectionBoxProps {
    isDragging: boolean;
    style: { left: number; top: number; width: number; height: number } | null;
}

export function SelectionBox({ isDragging, style }: SelectionBoxProps) {
    if (!isDragging || !style) return null;

    return (
        <div 
            className="absolute border border-emerald-500 bg-emerald-500/10 pointer-events-none z-50"
            style={{
                left: style.left,
                top: style.top,
                width: style.width,
                height: style.height
            }}
        />
    );
}

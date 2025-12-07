/**
 * Checkbox - Consistent checkbox with brand styling.
 * 
 * Consolidates the repeated pattern in SubjectPopup.tsx:
 * "w-5 h-5 rounded bg-[#8DC843] border-2 border-[#8DC843] flex items-center justify-center shadow-sm"
 */

import { Check, Minus } from 'lucide-react';
import { cn } from '../../ui/utils';

export interface CheckboxProps {
    /** Whether the checkbox is checked */
    checked: boolean;
    /** Whether the checkbox is in indeterminate state (for "select all") */
    indeterminate?: boolean;
    /** Click handler */
    onClick: () => void;
    /** Size variant */
    size?: 'sm' | 'md';
    /** Additional CSS classes */
    className?: string;
}

export function Checkbox({
    checked,
    indeterminate = false,
    onClick,
    size = 'md',
    className
}: CheckboxProps) {
    const sizeClasses = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    const iconSize = size === 'sm' ? 12 : 14;

    const isActive = checked || indeterminate;

    return (
        <div
            role="checkbox"
            aria-checked={indeterminate ? 'mixed' : checked}
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
            className={cn(
                'rounded border-2 flex items-center justify-center cursor-pointer transition-colors shadow-sm',
                sizeClasses,
                isActive
                    ? 'bg-[#79be15] border-[#79be15]'
                    : 'bg-white border-slate-300 hover:border-[#79be15]',
                className
            )}
        >
            {checked && !indeterminate && (
                <Check size={iconSize} className="text-white" strokeWidth={3} />
            )}
            {indeterminate && (
                <Minus size={iconSize} className="text-white" strokeWidth={3} />
            )}
        </div>
    );
}

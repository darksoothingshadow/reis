/**
 * FileItem - Single file row in the popover file list.
 */

import { FileText, ExternalLink } from 'lucide-react';
import { Checkbox } from '../atoms/Checkbox';

interface FileItemProps {
    fileName: string;
    comment?: string;
    isSelected: boolean;
    onToggleSelect: () => void;
    onOpen: () => void;
}

export function FileItem({ fileName, comment, isSelected, onToggleSelect, onOpen }: FileItemProps) {
    // Concatenate comment with filename if comment exists
    const displayName = comment ? `${fileName} - ${comment}` : fileName;

    return (
        <div
            className={`group flex items-center gap-2 p-2 rounded hover:bg-slate-50 transition-colors cursor-default ${isSelected ? 'bg-primary/10' : ''}`}
        >
            {/* Custom Checkbox Atom - always visible */}
            <Checkbox
                checked={isSelected}
                onClick={onToggleSelect}
                size="sm"
            />

            {/* File info + click to open */}
            <button
                onClick={onOpen}
                className="flex-1 flex items-center gap-2 text-left min-w-0 group/text"
            >
                <FileText size={14} className="text-slate-400 flex-shrink-0 transition-colors group-hover/text:text-primary" />
                <span className="text-xs text-slate-700 font-medium group-hover/text:text-primary group-hover/text:underline truncate">
                    {displayName}
                </span>
                <ExternalLink size={10} className="text-slate-300 opacity-0 group-hover/text:opacity-100 flex-shrink-0 transition-opacity" />
            </button>
        </div>
    );
}

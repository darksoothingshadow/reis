/**
 * PopoverHeader - Header with course code, room, teacher, and close button.
 */

import { X } from 'lucide-react';

interface PopoverHeaderProps {
    courseCode: string;
    room: string;
    teacherName?: string;
    onClose: () => void;
}

export function PopoverHeader({ courseCode, room, teacherName, onClose }: PopoverHeaderProps) {
    return (
        <div className="p-3 border-b border-slate-100 flex items-start justify-between bg-slate-50/50 rounded-t-lg">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{courseCode}</span>
                    <span className="badge badge-sm badge-ghost">{room}</span>
                </div>
                {teacherName && (
                    <div className="text-xs text-slate-500 mt-0.5 truncate">{teacherName}</div>
                )}
            </div>
            <button
                onClick={onClose}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
            >
                <X size={16} />
            </button>
        </div>
    );
}

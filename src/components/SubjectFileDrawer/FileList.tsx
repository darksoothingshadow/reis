/**
 * File List Component
 * 
 * Renders the file grid with selection support.
 */

import { Folder, FileText, Check } from 'lucide-react';
import type { FileListProps } from './types';

export function FileList({
    groups,
    selectedIds,
    fileRefs,
    ignoreClickRef,
    onToggleSelect,
    onOpenFile
}: FileListProps) {
    if (groups.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400 italic">
                Žádné soubory
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {groups.map(group => (
                <div key={group.name} className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-base-content/50 uppercase tracking-wider px-2">
                        <Folder size={14} />
                        {group.displayName}
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                        {group.files.map((file, i) => (
                            <div key={i} className="space-y-1">
                                {file.files.map((subFile, j) => {
                                    const isSelected = selectedIds.includes(subFile.link);
                                    return (
                                        <div
                                            key={subFile.link}
                                            ref={el => { if (el) fileRefs.current.set(subFile.link, el); }}
                                            onClick={(e) => {
                                                if (ignoreClickRef.current) return;
                                                if (e.ctrlKey || e.metaKey) {
                                                    onToggleSelect(subFile.link, e);
                                                } else {
                                                    onOpenFile(subFile.link);
                                                }
                                            }}
                                            className={`
                                                flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer group hover:shadow-sm
                                                ${isSelected 
                                                    ? 'bg-primary/10 border-primary/20 shadow-sm' 
                                                    : 'bg-base-100 border-transparent hover:bg-base-200/50 hover:border-base-300'
                                                }
                                            `}
                                        >
                                            <div 
                                                className={`
                                                    w-5 h-5 rounded border flex items-center justify-center transition-colors interactive
                                                    ${isSelected ? 'bg-primary border-primary' : 'border-base-300 group-hover:border-primary/50'}
                                                `}
                                                onClick={(e) => onToggleSelect(subFile.link, e)}
                                            >
                                                {isSelected && <Check size={12} className="text-primary-content" />}
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-medium truncate ${isSelected ? 'text-primary' : 'text-base-content'}`}>
                                                    {file.files.length > 1 ? `${file.file_name} (${j + 1})` : file.file_name}
                                                </div>
                                                {file.file_comment && (
                                                    <div className="text-xs text-base-content/50 truncate">{file.file_comment}</div>
                                                )}
                                            </div>

                                            <FileText size={16} className={`${isSelected ? 'text-primary/50' : 'text-base-content/20'}`} />
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * File List Loading Skeleton
 */
export function FileListSkeleton() {
    return (
        <div className="p-6 space-y-8">
            {[1, 2].map((i) => (
                <div key={i} className="space-y-3">
                    {/* Folder Header Skeleton */}
                    <div className="flex items-center gap-2 px-2">
                        <div className="skeleton w-4 h-4 rounded-full bg-slate-200"></div>
                        <div className="skeleton h-4 w-32 rounded bg-slate-200"></div>
                    </div>
                    {/* Files Grid Skeleton */}
                    <div className="grid grid-cols-1 gap-1">
                        {[1, 2, 3].map((j) => (
                            <div key={j} className="flex items-center gap-3 p-3 rounded-lg border border-transparent bg-base-100">
                                <div className="skeleton w-5 h-5 rounded bg-base-300"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="skeleton h-4 w-3/4 rounded bg-base-300"></div>
                                    <div className="skeleton h-3 w-1/2 rounded bg-base-300"></div>
                                </div>
                                <div className="skeleton w-4 h-4 rounded bg-base-300"></div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

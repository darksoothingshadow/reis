/**
 * DownloadButton - ZIP download button shown when 2+ files selected.
 */

import { Download, Loader2 } from 'lucide-react';

interface DownloadButtonProps {
    selectedCount: number;
    isDownloading: boolean;
    onDownload: () => void;
}

export function DownloadButton({ selectedCount, isDownloading, onDownload }: DownloadButtonProps) {
    if (selectedCount < 2) return null;

    return (
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 rounded-b-lg">
            <button
                onClick={onDownload}
                disabled={isDownloading}
                className="btn btn-primary btn-sm w-full gap-2"
            >
                {isDownloading ? (
                    <>
                        <Loader2 size={14} className="animate-spin" />
                        Stahování...
                    </>
                ) : (
                    <>
                        <Download size={14} />
                        Stáhnout ({selectedCount})
                    </>
                )}
            </button>
        </div>
    );
}

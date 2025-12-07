/**
 * useFileActions - Hook for file operations (open, download ZIP).
 */

import { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { normalizeFileUrl } from '../../utils/fileUrl';
import { createLogger } from '../../utils/logger';

const log = createLogger('useFileActions');

interface UseFileActionsResult {
    isDownloading: boolean;
    openFile: (link: string) => Promise<void>;
    downloadZip: (fileLinks: string[], zipFileName: string) => Promise<void>;
}

export function useFileActions(): UseFileActionsResult {
    const [isDownloading, setIsDownloading] = useState(false);

    const openFile = useCallback(async (link: string) => {
        log.debug(`Opening file: ${link}`);
        const fullUrl = normalizeFileUrl(link);

        try {
            log.debug('Fetching file as blob for inline viewing:', fullUrl);
            const response = await fetch(fullUrl, { credentials: 'include' });

            if (!response.ok) {
                log.warn('Fetch failed, falling back to direct link');
                window.open(fullUrl, '_blank');
                return;
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            log.debug('Created blob URL:', blobUrl, 'type:', blob.type);

            window.open(blobUrl, '_blank');

            // Clean up after 5 minutes
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000);
        } catch (e) {
            log.error('Failed to fetch file as blob, falling back to direct link', e);
            window.open(fullUrl, '_blank');
        }
    }, []);

    const downloadZip = useCallback(async (fileLinks: string[], zipFileName: string) => {
        if (fileLinks.length < 2) return;

        setIsDownloading(true);
        log.debug(`Downloading ZIP with ${fileLinks.length} files`);

        const zip = new JSZip();

        for (const link of fileLinks) {
            try {
                const fullUrl = normalizeFileUrl(link);
                const response = await fetch(fullUrl, { credentials: 'include' });
                if (!response.ok) continue;

                const blob = await response.blob();
                const cd = response.headers.get('content-disposition');
                let filename = 'file';
                if (cd) {
                    const match = cd.match(/filename="?([^"]+)"?/);
                    if (match?.[1]) filename = match[1];
                }
                zip.file(filename, blob);
            } catch (e) {
                log.error(`Failed to add file ${link} to zip`, e);
            }
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, zipFileName);
        setIsDownloading(false);
    }, []);

    return { isDownloading, openFile, downloadZip };
}

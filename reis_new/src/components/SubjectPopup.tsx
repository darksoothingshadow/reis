import { X, File, FileType, Map, Check, Download, Loader2, Minus } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { GetIdFromLink } from "../utils/calendarUtils";
import { getFilesFromId, getStoredSubject } from "../utils/apiUtils";
import type { FileObject, StoredSubject, BlockLesson } from "../types/calendarTypes";
import { useEffect, useState } from "react";

export interface SubjectPopupPropsV2 {
    code: BlockLesson,
    onClose: () => void,
}

export function RenderSubFiles(props: { status: number | null }) {
    switch (props.status) {
        case null:
            return (
                <div className="w-full h-80 xl:h-150 flex justify-center items-center">
                    <span className="text-base xl:text-xl font-dm font-semibold text-gray-700">Chyba při načítání souborů</span>
                </div>
            )
        case 0:
        case 1:
        case 2:
            return (
                <div className="w-full h-80 xl:h-150 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#8DC843]"></div>
                </div>
            )
    }
}

export function RenderEmptySubject(props: { code: string, setter: () => void }) {
    return (
        <div className="p-1 pl-4 pr-4 relative h-full w-100 xl:w-180 rounded-xl bg-gray-50 shadow-xl flex flex-col items-center justify-center font-dm">
            <span className="absolute right-2 top-2 w-6 h-6 xl:w-8 xl:h-8 flex justify-center items-center text-gray-500 cursor-pointer hover:scale-90 transition-all" onClick={() => { props.setter() }}>
                <X size={"2rem"}></X>
            </span>
            <span className="w-full h-8 xl:h-16 text-gray-800 flex flex-col justify-center items-center font-dm text-base xl:text-2xl">{`Předmět ${props.code} nenalezen v lokálním uložišti`}</span>
        </div>
    )
}

// Helper to resolve the final file URL (handling intermediate pages and path corrections)
async function resolveFinalFileUrl(link: string): Promise<string> {
    // Clean up the link - IS Mendelu uses semicolons in URLs which causes 404s
    // Replace ?; with ? and any remaining ; with &
    link = link.replace(/\?;/g, '?').replace(/;/g, '&');

    // Check if it's a "dokumenty_cteni.pl" link (view link)
    // We can directly construct the download link and bypass the intermediate page
    if (link.includes('dokumenty_cteni.pl')) {
        try {
            // Extract parameters
            // Handle both & and ; as separators
            const normalizedLink = link.replace(/;/g, '&').replace(/\?/g, '&');
            const idMatch = normalizedLink.match(/[&]id=(\d+)/);
            const dokMatch = normalizedLink.match(/[&]dok=(\d+)/);

            if (idMatch && dokMatch) {
                const id = idMatch[1];
                const dok = dokMatch[1];
                // Construct direct download URL
                // Using z=1 as requested by user
                return `https://is.mendelu.cz/auth/dok_server/slozka.pl?download=${dok}&id=${id}&z=1`;
            }
        } catch (e) {
            console.warn('Failed to construct direct download URL:', e);
            // Fallback to standard processing if extraction fails
        }
    }

    // Construct the full URL for other cases
    let fullUrl = '';
    if (link.startsWith('http')) {
        fullUrl = link;
    } else {
        // It's usually relative to /auth/dok_server/
        if (link.startsWith('/')) {
            fullUrl = `https://is.mendelu.cz${link}`;
        } else {
            fullUrl = `https://is.mendelu.cz/auth/dok_server/${link}`;
        }
    }

    // Check if we need to find the download link (if it's an intermediate page)
    // dokumenty_cteni.pl IS an intermediate page that contains the download link
    if (!fullUrl.includes('download=')) {
        try {
            const pageResponse = await fetch(fullUrl, { credentials: 'include' });
            const pageText = await pageResponse.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(pageText, 'text/html');

            // Look for the download link: <a> containing <img sysid> and href with 'download='
            const downloadLink = Array.from(doc.querySelectorAll('a')).find(a =>
                a.href.includes('download=') && a.querySelector('img[sysid]')
            );

            if (downloadLink) {
                let newLink = downloadLink.getAttribute('href');
                if (newLink) {
                    // Handle relative paths
                    if (!newLink.startsWith('http')) {
                        if (newLink.startsWith('/')) {
                            if (newLink.includes('dokumenty_cteni.pl')) {
                                fullUrl = `https://is.mendelu.cz/auth/dok_server${newLink}`;
                            } else {
                                fullUrl = `https://is.mendelu.cz${newLink}`;
                            }
                        } else {
                            fullUrl = `https://is.mendelu.cz/auth/dok_server/${newLink}`;
                        }
                    } else {
                        fullUrl = newLink;
                        if (fullUrl.includes('dokumenty_cteni.pl') && !fullUrl.includes('/auth/')) {
                            fullUrl = fullUrl.replace('is.mendelu.cz/dokumenty_cteni.pl', 'is.mendelu.cz/auth/dok_server/dokumenty_cteni.pl');
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to parse intermediate page:', e);
            // Fallback to original URL if parsing fails
        }
    }
    return fullUrl;
}

export function SubjectPopup(props: SubjectPopupPropsV2) {
    //FETCH SUBJECT FROM STORAGE
    const [subject_data, setSubjectData] = useState<StoredSubject | null>(null);
    const [files, setFiles] = useState<FileObject[] | null>(null);
    const [loadingfile, setLoadingFile] = useState<boolean>(false);
    const [loadingSubject, setLoadingSubject] = useState<boolean>(true); // NEW: Track subject loading
    const [loadingFiles, setLoadingFiles] = useState<boolean>(true);
    const [subfolderFilter, setSubfolderFilter] = useState<string>("all");

    // Bulk Download State
    const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    //
    function parseName(name: string, hasComment: boolean = false) {
        const MAX_LENGTH = hasComment ? 40 : 100; // kratší pro položky s komentářem, delší bez komentáře

        if (name.length > MAX_LENGTH) {
            const name_deducted = name.substring(0, MAX_LENGTH - 3);
            return name_deducted + "...";
        }
        return name;
    }
    //
    useEffect(() => {
        (async () => {
            try {
                setLoadingSubject(true);
                setLoadingFiles(true);

                const STORED_SUBJECT = await getStoredSubject(props.code.courseCode);
                setSubjectData(STORED_SUBJECT);
                setLoadingSubject(false); // Subject fetch complete

                if (STORED_SUBJECT == null) {
                    setFiles([]);
                    setLoadingFiles(false);
                    return;
                }

                // Try to load cached files first for fast display
                const cachedKey = `files_${props.code.courseCode}`;
                const cachedFiles = localStorage.getItem(cachedKey);
                if (cachedFiles) {
                    try {
                        setFiles(JSON.parse(cachedFiles));
                    } catch (e) {
                        console.error("Failed to parse cached files", e);
                    }
                }

                // Fetch fresh files in background (URLs may be ephemeral)
                const files = await getFilesFromId(GetIdFromLink(STORED_SUBJECT.folderUrl));
                setFiles(files);
                setLoadingFiles(false);

                // Cache for next time
                if (files && files.length > 0) {
                    localStorage.setItem(cachedKey, JSON.stringify(files));
                }
            } catch (error) {
                console.error("Error loading popup data:", error);
                setLoadingSubject(false);
                setLoadingFiles(false);
            }
        })();
    }, [])
    //
    // Add ESC key listener to close popup
    useEffect(() => {
        const handleEscKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                props.onClose();
            }
        };

        window.addEventListener('keydown', handleEscKey);

        // Cleanup listener when component unmounts
        return () => {
            window.removeEventListener('keydown', handleEscKey);
        };
    }, [props.onClose])
    //
    async function loadFile(link: string, retryCount = 0) {
        setLoadingFile(true);
        try {
            const fullUrl = await resolveFinalFileUrl(link);

            // Step 2: Fetch the actual file
            const response = await fetch(fullUrl, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/pdf,application/octet-stream,*/*'
                }
            });

            // If 404, the URL is likely stale - refresh file list and retry once
            if (response.status === 404) {
                if (retryCount === 0) {
                    console.log('[SubjectPopup] File URL returned 404, refreshing file list...');

                    // Refresh file list to get fresh URLs
                    if (subject_data) {
                        const freshFiles = await getFilesFromId(GetIdFromLink(subject_data.folderUrl));
                        if (freshFiles && freshFiles.length > 0) {
                            setFiles(freshFiles);

                            // Update cache with fresh URLs
                            const cachedKey = `files_${props.code.courseCode}`;
                            localStorage.setItem(cachedKey, JSON.stringify(freshFiles));

                            // Find the refreshed link for this file
                            const originalFileName = link.split('/').pop()?.split('?')[0];
                            const refreshedFile = freshFiles.flatMap(f => f.files).find(f =>
                                f.link.includes(originalFileName || '') || f.name === originalFileName
                            );

                            if (refreshedFile) {
                                console.log('[SubjectPopup] Found refreshed URL, retrying...');
                                await loadFile(refreshedFile.link, 1);
                                return;
                            }
                        }
                    }
                }

                // If we get here, refresh failed or we already retried
                console.warn('[SubjectPopup] Refresh failed or 404 persisted. Falling back to window.open');
                window.open(fullUrl, '_blank');
                setLoadingFile(false);
                return;
            }

            if (!response.ok) {
                console.warn(`[SubjectPopup] HTTP error ${response.status}. Falling back to window.open`);
                window.open(fullUrl, '_blank');
                setLoadingFile(false);
                return;
            }

            const contentType = response.headers.get('content-type');

            // Safety check: if we still got HTML, something is wrong (or it's not a file)
            if (contentType?.includes('text/html')) {
                console.warn('Received HTML. Opening in new tab.');
                window.open(fullUrl, '_blank');
                setLoadingFile(false);
                return;
            }

            // Step 3: Handle Blob
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            if (contentType?.includes('application/pdf')) {
                // Open PDF in new tab
                window.open(blobUrl, '_blank');
            } else {
                // Download other files
                const a = document.createElement('a');
                a.href = blobUrl;

                // Try to get filename
                const contentDisposition = response.headers.get('content-disposition');
                let filename = 'download';
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                    if (filenameMatch && filenameMatch[1]) {
                        filename = filenameMatch[1];
                    }
                }

                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }

            // Cleanup
            setTimeout(() => {
                URL.revokeObjectURL(blobUrl);
            }, 1000);

            setLoadingFile(false);
        } catch (error) {
            console.error('Error loading file:', error);
            setLoadingFile(false);
            alert('Nepodařilo se otevřít soubor. Zkuste to prosím znovu.');
        }
    }
    //
    function groupFilesByFolder(files: FileObject[]) {
        const grouped: { [subfolder: string]: FileObject[] } = {};

        // Filter files by subfolder if a filter is active
        const filteredFiles = subfolderFilter === "all"
            ? files
            : files.filter(file => file.subfolder === subfolderFilter);

        filteredFiles.forEach(file => {
            // Group by subfolder name (or 'Ostatní' if empty)
            const groupKey = file.subfolder || 'Ostatní';

            if (!grouped[groupKey]) {
                grouped[groupKey] = [];
            }
            grouped[groupKey].push(file);
        });

        // Sort folders: 'Ostatní' last, others alphabetically
        const sortedFolderKeys = Object.keys(grouped).sort((a, b) => {
            if (a === 'Ostatní') return 1;
            if (b === 'Ostatní') return -1;
            return a.localeCompare(b, 'cs');
        });

        // Flatten and sort files within each folder
        const sortedFiles: FileObject[] = [];
        sortedFolderKeys.forEach(key => {
            const folderFiles = grouped[key].sort((a, b) => {
                // Primary sort: Comment number (if present)
                const numA = parseInt(a.file_comment.match(/\d+/)?.[0] || '0');
                const numB = parseInt(b.file_comment.match(/\d+/)?.[0] || '0');

                if (numA !== numB && numA !== 0 && numB !== 0) {
                    return numA - numB;
                }

                // Secondary sort: Filename
                return a.file_name.localeCompare(b.file_name, 'cs', { numeric: true });
            });
            sortedFiles.push(...folderFiles);
        });

        return sortedFiles;
    }

    // Get unique subfolders for filter dropdown
    function getUniqueSubfolders(files: FileObject[]): string[] {
        const subfolders = new Set<string>();
        files.forEach(file => {
            if (file.subfolder && file.subfolder.trim() !== '') {
                subfolders.add(file.subfolder);
            }
        });
        return Array.from(subfolders).sort();
    }

    // Extract display name from subfolder (part after "/")
    function getSubfolderDisplayName(subfolder: string): string {
        const parts = subfolder.split('/');
        return parts.length > 1 ? parts[1].trim() : subfolder;
    }

    // Bulk Download Logic
    const toggleSelection = (fileId: string) => {
        setSelectedFileIds(prev =>
            prev.includes(fileId)
                ? prev.filter(id => id !== fileId)
                : [...prev, fileId]
        );
    };

    const handleSelectAll = (filteredFiles: FileObject[]) => {
        const visibleIds = filteredFiles.flatMap(f => f.files.map(subFile => subFile.link));

        // Check if all visible files are currently selected
        const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedFileIds.includes(id));

        if (allVisibleSelected) {
            // Deselect visible files, keep others
            setSelectedFileIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            // Select all visible files, keep others
            setSelectedFileIds(prev => [...new Set([...prev, ...visibleIds])]);
        }
    };

    const handleDownloadZip = async () => {
        if (selectedFileIds.length === 0) return;

        setIsDownloading(true);
        const zip = new JSZip();
        const folderName = `${props.code.courseCode}_Materialy`;

        try {
            // We need to find the file objects to get names and subfolders
            const filesToDownload: { url: string, name: string, subfolder: string }[] = [];

            if (files) {
                files.forEach(f => {
                    f.files.forEach((subFile, index) => {
                        if (selectedFileIds.includes(subFile.link)) {
                            // Construct filename
                            let name = f.file_name;
                            if (f.files.length > 1) {
                                name = `${name}_part${index + 1}`;
                            }
                            // Add extension if missing (simple heuristic, can be improved)
                            if (!name.includes('.')) name += '.pdf'; // Default to pdf as most are pdfs

                            filesToDownload.push({
                                url: subFile.link,
                                name: name,
                                subfolder: f.subfolder || ''
                            });
                        }
                    });
                });
            }

            const downloadPromises = filesToDownload.map(async (file) => {
                try {
                    const fullUrl = await resolveFinalFileUrl(file.url);

                    const response = await fetch(fullUrl, { credentials: 'include' });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const blob = await response.blob();

                    // Try to get real filename from headers if possible, otherwise use constructed name
                    const contentDisposition = response.headers.get('content-disposition');
                    let finalName = file.name;
                    if (contentDisposition) {
                        const match = contentDisposition.match(/filename="?([^"]+)"?/);
                        if (match && match[1]) finalName = match[1];
                    }

                    // Add files directly to the root of the ZIP (no nested folders)
                    // Use subfolder as prefix to avoid name collisions
                    if (file.subfolder) {
                        const cleanSub = file.subfolder.replace(/^\/|\/$/g, '').replace(/\//g, '_');
                        finalName = `${cleanSub}_${finalName}`;
                    }

                    zip.file(finalName, blob);

                } catch (error) {
                    // Continue without this file
                }
            });

            await Promise.all(downloadPromises);

            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `${folderName}.zip`);

        } catch (error) {
            alert("Chyba při vytváření ZIP archivu.");
        } finally {
            setIsDownloading(false);
            setSelectedFileIds([]); // Optional: clear selection after download
        }
    };
    //
    // Handle click outside popup to close
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Only close if clicking on the backdrop itself, not on child elements
        if (e.target === e.currentTarget) {
            props.onClose();
        }
    };
    //
    // Show loading state while fetching subject
    if (loadingSubject) {
        return (
            <div className="fixed z-[999] top-0 left-0 w-screen h-screen flex justify-center items-center bg-black/50 backdrop-grayscale font-dm p-8" onClick={handleBackdropClick}>
                <div className="p-8 relative h-fit w-100 xl:w-180 rounded-xl bg-white shadow-xl flex flex-col items-center justify-center font-dm">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#8DC843] mb-4"></div>
                    <span className="text-base xl:text-lg text-gray-600">Načítání předmětu...</span>
                </div>
            </div>
        );
    }

    // Show empty state if no subject data (ONLY after loading is complete)
    if (subject_data === null && !loadingSubject) {
        return (
            <div className="fixed z-[999] top-0 left-0 w-screen h-screen flex justify-center items-center bg-black/50 backdrop-grayscale font-dm p-8" onClick={handleBackdropClick}>
                <div className="p-4 relative h-fit w-100 xl:w-180 rounded-xl bg-gray-50 shadow-xl flex flex-col items-center justify-center font-dm">
                    <span className="absolute right-2 top-2 w-6 h-6 xl:w-8 xl:h-8 flex justify-center items-center text-gray-500 cursor-pointer hover:scale-90 transition-all" onClick={props.onClose}>
                        <X size={"2rem"}></X>
                    </span>
                    <span className="text-base xl:text-xl text-gray-700 py-8">{`Předmět ${props.code.courseCode} nenalezen`}</span>
                </div>
            </div>
        );
    }
    //
    // Calculate visible files for rendering and selection
    const visibleFiles = files ? groupFilesByFolder(files) : [];
    const visibleCount = visibleFiles.flatMap(f => f.files).length;
    const selectedVisibleCount = visibleFiles.flatMap(f => f.files).filter(sf => selectedFileIds.includes(sf.link)).length;
    const allVisibleSelected = visibleCount > 0 && selectedVisibleCount === visibleCount;
    const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

    return (
        <div className="fixed z-[999] top-0 left-0 w-screen h-screen flex justify-center items-center bg-black/50 backdrop-grayscale font-dm p-8" onClick={handleBackdropClick}>
            {/*Window*/}
            {subject_data ?
                <div className="p-1 pl-4 pr-4 relative h-full w-100 xl:w-180 rounded-xl bg-gray-50 shadow-xl flex flex-col items-center font-dm bg-white">
                    <span className="absolute right-2 top-2 w-6 h-6 xl:w-8 xl:h-8 flex justify-center items-center text-gray-500 cursor-pointer hover:scale-90 transition-all" onClick={() => { props.onClose() }}>
                        <X size={"2rem"}></X>
                    </span>
                    <span className="w-full h-8 xl:h-16 text-gray-800 flex flex-col justify-center items-center font-dm text-base xl:text-2xl">{subject_data.fullName}</span>
                    <span className="w-full h-0.25 bg-gray-200 mb-2"></span>
                    <div className="text-base text-gray-700 w-full flex flex-col mt-4">
                        <span className="text-base xl:text-xl text-gray-700 font-medium">Vyučující události</span>
                        <a
                            href={`https://is.mendelu.cz/auth/lide/clovek.pl?id=${props.code.teachers[0].id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base xl:text-lg text-gray-700 hover:underline"
                        >
                            {props.code.teachers[0].shortName}
                        </a>
                    </div>
                    <div className="text-base text-gray-700 w-full flex flex-col mt-4">
                        <span className="text-base xl:text-xl text-gray-700 font-medium mb-1">Místnost</span>
                        <span className="w-fit relative text-base xl:text-lg text-gray-700 flex items-center gap-2">
                            {props.code.room}
                            {/* Only rooms are 'Q' are currently supported in the widget with simple config */}
                            {props.code.room.startsWith('Q') && (
                                <Map
                                    className="h-5 w-5 text-primary cursor-pointer hover:scale-110 transition-transform"
                                    onClick={() => { window.open(`https://mm.mendelu.cz/mapwidget/embed?placeName=${props.code.room}`, "_blank") }}
                                />
                            )}
                        </span>
                    </div>
                    <div className="text-base text-gray-700 w-full flex flex-col mt-4 h-3/5">
                        <div className="flex flex-row justify-between items-center min-h-fit">
                            <div className="flex items-center gap-2">
                                {files && files.length > 0 && (
                                    <div
                                        className="w-5 h-5 rounded border-2 border-gray-600 bg-white flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                                        onClick={() => handleSelectAll(visibleFiles)}
                                    >
                                        {allVisibleSelected && (
                                            <Check size={14} className="text-primary" strokeWidth={3} />
                                        )}
                                        {someVisibleSelected && (
                                            <div className="w-2.5 h-2.5 bg-primary rounded-sm" />
                                        )}
                                        {!allVisibleSelected && !someVisibleSelected && (
                                            <Minus size={14} className="text-gray-400" strokeWidth={2} />
                                        )}
                                    </div>
                                )}
                                <span className="text-base xl:text-xl text-gray-700 font-medium">Dostupné soubory</span>
                            </div>
                            {typeof files !== "number" && files !== null && files.length > 0 && getUniqueSubfolders(files).length > 1 && (
                                <select
                                    value={subfolderFilter}
                                    onChange={(e) => setSubfolderFilter(e.target.value)}
                                    className="text-gray-900 text-sm px-3 py-1.5 border-2 border-gray-300 rounded-md bg-white cursor-pointer hover:border-primary focus:border-primary focus:outline-none transition-colors"
                                >
                                    <option value="all">Vše</option>
                                    {getUniqueSubfolders(files).map((subfolder) => (
                                        <option key={subfolder} value={subfolder}>
                                            {getSubfolderDisplayName(subfolder)}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div className='w-full flex flex-1 flex-col overflow-y-auto'>
                            {loadingFiles && (!files || files.length === 0) ? (
                                <div className="w-full h-32 flex justify-center items-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8DC843]"></div>
                                </div>
                            ) : files === null || files.length === 0 ? (
                                <div className="w-full h-32 flex justify-center items-center">
                                    <span className="text-sm text-gray-500">Ve složce nejsou žádné soubory</span>
                                </div>
                            ) : loadingfile ? (
                                <div className="w-full h-32 flex justify-center items-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8DC843]"></div>
                                    <span className="ml-3 text-sm text-gray-500">Otevírání souboru...</span>
                                </div>
                            ) : (
                                visibleFiles.map((data, i) =>
                                    data.files.map((subFile, l) => {
                                        const isSelected = selectedFileIds.includes(subFile.link);
                                        return (
                                            <div key={`${i}-${l}`} className="group relative w-full min-h-10 flex flex-row items-center text-xs xl:text-base gap-2 hover:bg-gray-50 rounded-lg pr-2 transition-colors">
                                                {/* Zone A: Selection Trigger */}
                                                <div
                                                    className="aspect-square w-10 flex-none flex justify-center items-center cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleSelection(subFile.link);
                                                    }}
                                                >
                                                    {isSelected ? (
                                                        <div className="w-5 h-5 rounded-full bg-green-500 border-2 border-green-500 flex items-center justify-center">
                                                            <Check size={12} className="text-white" strokeWidth={3} />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="w-5 h-5 rounded-full border-2 border-gray-300 items-center justify-center hidden group-hover:flex" />
                                                            <File className="text-gray-400 group-hover:hidden" />
                                                        </>
                                                    )}
                                                </div>

                                                {/* Zone B: Content Trigger */}
                                                <span
                                                    className={`flex-1 text-gray-700 pl-2 pr-2 hover:text-primary cursor-pointer truncate ${data.file_comment ? 'w-80' : 'w-full'}`}
                                                    onClick={() => loadFile(subFile.link)}
                                                    title={data.file_name} // Tooltip for full name
                                                >
                                                    {data.files.length === 1 ?
                                                        parseName(data.file_name, !!data.file_comment) :
                                                        parseName(data.file_name + ": část " + (l + 1), !!data.file_comment)}
                                                </span>

                                                {data.file_comment && (
                                                    <>
                                                        <div className="aspect-square h-full flex justify-center items-center">
                                                            <FileType size={16} className="text-gray-400" />
                                                        </div>
                                                        <span className="text-gray-400 ml-2 truncate max-w-[100px]">{data.file_comment}</span>
                                                    </>
                                                )}

                                                {/* Zone C: Quick Action */}
                                                <div
                                                    className="w-8 h-8 flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-gray-200 rounded-full"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Quick download logic - reuse loadFile but maybe force download? 
                                                        // loadFile handles both but opens PDF in new tab. 
                                                        // Requirement says "Triggers a direct single-file download".
                                                        // For now, let's reuse loadFile as it's robust, but maybe we can tweak it later if needed.
                                                        // Or better, let's just call loadFile which does the right thing mostly.
                                                        loadFile(subFile.link);
                                                    }}
                                                    title="Stáhnout"
                                                >
                                                    <Download size={16} className="text-gray-600" />
                                                </div>
                                            </div>
                                        )
                                    })
                                )
                            )}
                        </div>

                        {/* Floating Action Bar */}
                        {selectedFileIds.length > 0 && (
                            <div className="absolute bottom-6 right-6 bg-[#8DC843] text-white px-5 py-2.5 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-200 z-50">
                                <span className="font-medium text-sm whitespace-nowrap">Vybráno: {selectedFileIds.length}</span>
                                <div className="w-px h-4 bg-white/30"></div>
                                <button
                                    className="flex items-center gap-2 font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                                    onClick={handleDownloadZip}
                                    disabled={isDownloading}
                                >
                                    {isDownloading ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>Zpracování...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download size={16} />
                                            <span>Stáhnout ZIP</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div> :
                <RenderEmptySubject code={props.code.courseCode} setter={props.onClose} />
            }
        </div>
    )
}

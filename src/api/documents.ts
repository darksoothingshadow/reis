import { fetchWithAuth, BASE_URL } from "./client";
import type { ParsedFile, FileAttachment } from "../types/documents";
import { fetchSubjects } from "./subjects";
import { requestQueue, processWithDelay } from "../utils/requestQueue";
import { createLogger } from "../utils/logger";

// Re-export from parsers for backward compatibility
export { parseServerFiles } from "../parsers/documents";
import { parseServerFiles } from "../parsers/documents";

const log = createLogger('Files');

export async function fetchDocumentsForSubject(subjectCode: string): Promise<FileAttachment[]> {
    const subjectsData = await fetchSubjects();
    if (!subjectsData) return [];

    const subject = subjectsData.data[subjectCode];
    if (!subject || !subject.folderUrl) return [];

    const parsedFiles = await fetchFilesFromFolder(subject.folderUrl);

    // Flatten the structure to just return all files for now, or we could keep the folder structure
    // The dialog expects FileAttachment[], so let's flatten
    const allFiles: FileAttachment[] = [];
    parsedFiles.forEach(pf => {
        allFiles.push(...pf.files);
    });

    return allFiles;
}

export async function fetchFilesFromFolder(folderUrl: string, recursive: boolean = true, currentDepth: number = 0, maxDepth: number = 2): Promise<ParsedFile[]> {
    try {
        // Ensure lang=cz is present
        let urlToFetch = folderUrl;
        if (!urlToFetch.includes('lang=')) {
            urlToFetch += (urlToFetch.includes('?') ? ';' : '?') + 'lang=cz';
        }

        log.debug(`Fetching folder: ${urlToFetch} (depth: ${currentDepth}/${maxDepth})`);
        const response = await fetchWithAuth(urlToFetch);
        const html = await response.text();
        const { files, paginationLinks } = parseServerFiles(html);
        log.info(`Found ${files.length} items, ${paginationLinks.length} pagination pages`);

        // Handle pagination
        if (paginationLinks && paginationLinks.length > 0) {
            // Fetch pagination pages sequentially via request queue to avoid overwhelming the server
            for (const link of paginationLinks) {
                // Construct absolute URL
                let pageUrl = link.startsWith('http') ? link : `${BASE_URL}/auth/dok_server/${link.replace(/^\/auth\/dok_server\//, '')}`;

                // Ensure lang=cz
                if (!pageUrl.includes('lang=')) {
                    pageUrl += (pageUrl.includes('?') ? ';' : '?') + 'lang=cz';
                }

                // Use request queue to throttle concurrent requests
                const pageResult = await requestQueue.add(async () => {
                    const pageResponse = await fetchWithAuth(pageUrl);
                    const pageHtml = await pageResponse.text();
                    return parseServerFiles(pageHtml);
                });
                files.push(...pageResult.files);
            }
        }

        // If recursive mode is enabled, fetch files from subfolders too
        if (recursive && currentDepth < maxDepth) {
            const allFiles: ParsedFile[] = [...files];

            // Collect folders to fetch, then process sequentially with delay
            const foldersToFetch: { absoluteUrl: string; parentName: string }[] = [];

            for (const file of files) {
                // Check if this is a folder link (not a downloadable file)
                // Folders usually have slozka.pl and NO download parameter
                const isFolder = file.files.some(f =>
                    f.link.includes('slozka.pl') && !f.link.includes('download')
                );

                if (isFolder && file.files.length > 0) {
                    const folderLink = file.files[0].link;
                    let absoluteUrl: string;

                    // Robust handling for slozka.pl links
                    if (folderLink.includes('slozka.pl')) {
                        if (folderLink.startsWith('http')) {
                            absoluteUrl = folderLink;
                        } else {
                            absoluteUrl = `${BASE_URL}/auth/dok_server/${folderLink.replace(/^\/auth\/dok_server\//, '')}`;
                        }
                    } else {
                        absoluteUrl = folderLink.startsWith('http')
                            ? folderLink
                            : folderLink.startsWith('/')
                                ? `${BASE_URL}${folderLink}`
                                : `${BASE_URL}/auth/dok_server/${folderLink}`;
                    }

                    foldersToFetch.push({ absoluteUrl, parentName: file.file_name });
                }
            }

            // Fetch subfolders sequentially with 200ms delay to avoid overwhelming the server
            const subfolderResults = await processWithDelay(
                foldersToFetch,
                async ({ absoluteUrl, parentName }) => {
                    const subfolderFiles = await fetchFilesFromFolder(absoluteUrl, true, currentDepth + 1, maxDepth);
                    // Add subfolder info to each file
                    subfolderFiles.forEach(sf => {
                        sf.subfolder = parentName;
                    });
                    return subfolderFiles;
                },
                200 // 200ms delay between subfolder fetches
            );

            // Merge all subfolder results
            subfolderResults.forEach(files => allFiles.push(...files));

            // Filter out folder entries, keep only actual files
            // Also deduplicate files based on link just in case pagination caused overlaps
            const uniqueFiles = new Map<string, ParsedFile>();
            allFiles.forEach(f => {
                // Use the first file's link as key (assuming one file per ParsedFile entry usually)
                if (f.files.length > 0) {
                    const key = f.files[0].link;
                    // Only keep if it's a download link or we haven't seen it
                    if (!uniqueFiles.has(key) || (key.includes('download') && !uniqueFiles.get(key)?.files[0].link.includes('download'))) {
                        uniqueFiles.set(key, f);
                    }
                }
            });

            return Array.from(uniqueFiles.values()).filter(file =>
                file.files.some(f => f.link.includes('download') || !f.link.includes('slozka.pl'))
            );
        }

        return files;
    } catch (error) {
        log.error(`Failed to fetch folder: ${folderUrl}`, error);
        return [];
    }
}

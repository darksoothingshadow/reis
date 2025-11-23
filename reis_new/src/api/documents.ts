import { fetchWithAuth, BASE_URL } from "./client";
import type { ParsedFile, FileAttachment } from "../types/documents";
import { fetchSubjects } from "./subjects";
import { sanitizeString, validateFileName, validateUrl } from "../utils/validation";

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

export async function fetchFilesFromFolder(folderUrl: string, recursive: boolean = true): Promise<ParsedFile[]> {
    try {
        const response = await fetchWithAuth(folderUrl);
        const html = await response.text();
        const files = parseServerFiles(html);

        // If recursive mode is enabled, fetch files from subfolders too
        if (recursive) {
            const allFiles: ParsedFile[] = [...files];

            for (const file of files) {
                // Check if this is a folder link (not a downloadable file)
                const isFolder = file.files.some(f =>
                    f.link.includes('slozka.pl') && !f.link.includes('download')
                );

                if (isFolder && file.files.length > 0) {
                    let folderLink = file.files[0].link;
                    let absoluteUrl: string;

                    // Robust handling for slozka.pl links
                    if (folderLink.includes('slozka.pl')) {
                        // Extract query string - handle both ? and ; as separators
                        // First, normalize the link to use ? for the start of query and & for parameters
                        // But be careful not to double-replace if it's already correct

                        // Strategy: find where slozka.pl ends
                        const splitIndex = folderLink.indexOf('slozka.pl') + 9;
                        const queryPart = folderLink.substring(splitIndex);

                        // If there is a query part
                        if (queryPart.length > 0) {
                            // Replace all semicolons with ampersands
                            let cleanQuery = queryPart.replace(/;/g, '&');
                            // Ensure the first character is ? if it's not empty
                            if (cleanQuery.startsWith('&') || cleanQuery.startsWith('?')) {
                                cleanQuery = '?' + cleanQuery.substring(1);
                            } else if (cleanQuery.length > 0) {
                                cleanQuery = '?' + cleanQuery;
                            }

                            absoluteUrl = `${BASE_URL}/auth/dok_server/slozka.pl${cleanQuery}`;
                        } else {
                            absoluteUrl = `${BASE_URL}/auth/dok_server/slozka.pl`;
                        }
                    } else {
                        // Standard handling for other links
                        absoluteUrl = folderLink.startsWith('http')
                            ? folderLink
                            : folderLink.startsWith('/')
                                ? `${BASE_URL}${folderLink}`
                                : `${BASE_URL}/auth/dok_server/${folderLink}`;
                    }

                    console.log(`Fetching subfolder: ${file.file_name}`, absoluteUrl);
                    const subfolderFiles = await fetchFilesFromFolder(absoluteUrl, false); // Don't recurse deeper

                    // Add subfolder info to each file
                    subfolderFiles.forEach(sf => {
                        sf.subfolder = file.file_name;
                    });

                    allFiles.push(...subfolderFiles);
                }
            }

            // Filter out folder entries, keep only actual files
            return allFiles.filter(file =>
                file.files.some(f => f.link.includes('download') || !f.link.includes('slozka.pl'))
            );
        }

        return files;
    } catch (error) {
        console.error("Failed to fetch files:", error);
        return [];
    }
}


export function parseServerFiles(html: string): ParsedFile[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Check if this is a "Read document" page (detail page)
    const attachmentsLabel = Array.from(doc.querySelectorAll('td')).find(td => td.textContent?.includes('Attachments:') || td.textContent?.includes('Přílohy:'));
    if (attachmentsLabel) {
        console.log("Detected 'Read document' detail page");
        const row = attachmentsLabel.parentElement;
        const link = row?.querySelector('a')?.getAttribute('href');

        if (link) {
            // Extract metadata from other rows
            const nameRow = Array.from(doc.querySelectorAll('td')).find(td => td.textContent?.includes('Name:') || td.textContent?.includes('Názov:') || td.textContent?.includes('Název:'))?.parentElement;
            const name = nameRow?.querySelectorAll('td')[1]?.textContent?.trim() || 'Unknown';

            const authorRow = Array.from(doc.querySelectorAll('td')).find(td => td.textContent?.includes('Entered by:') || td.textContent?.includes('Vložil:') || td.textContent?.includes('Zadal:'))?.parentElement;
            const author = authorRow?.querySelectorAll('td')[1]?.textContent?.trim() || '';

            const dateRow = Array.from(doc.querySelectorAll('td')).find(td => td.textContent?.includes('Document date:') || td.textContent?.includes('Datum dokumentu:') || td.textContent?.includes('Dátum dokumentu:'))?.parentElement;
            const date = dateRow?.querySelectorAll('td')[1]?.textContent?.trim() || '';

            const commentRow = Array.from(doc.querySelectorAll('td')).find(td => td.textContent?.includes('Comments:') || td.textContent?.includes('Poznámka:') || td.textContent?.includes('Komentář:'))?.parentElement;
            const comment = commentRow?.querySelectorAll('td')[1]?.textContent?.trim() || '';

            const img = row?.querySelector('img[sysid]');
            const type = img?.getAttribute('sysid')?.replace('mime-', '') || 'unknown';

            // Sanitize extracted metadata
            const sanitizedName = validateFileName(name);
            const sanitizedComment = sanitizeString(comment, 500);
            const sanitizedAuthor = sanitizeString(author, 200);
            const validatedUrl = validateUrl(link, 'is.mendelu.cz');

            if (!sanitizedName || !validatedUrl) {
                console.warn('parseServerFiles: invalid file metadata');
                return [];
            }

            return [{
                subfolder: '',
                file_name: sanitizedName,
                file_comment: sanitizedComment,
                author: sanitizedAuthor,
                date: date,
                files: [{
                    name: sanitizedName,
                    type: type,
                    link: validatedUrl
                }]
            }];
        }
    }

    // Try multiple selectors to find the table rows
    let rows = doc.querySelectorAll('tr.uis-hl-table.lbn');
    console.log(`Found ${rows.length} rows with 'tr.uis-hl-table.lbn'`);

    // If no rows found, try less strict selector
    if (rows.length === 0) {
        rows = doc.querySelectorAll('tr.uis-hl-table');
        console.log(`Found ${rows.length} rows with 'tr.uis-hl-table'`);
    }

    // If still no rows, try even more general
    if (rows.length === 0) {
        rows = doc.querySelectorAll('table tr');
        console.log(`Found ${rows.length} rows with 'table tr'`);
    }

    const files: ParsedFile[] = [];

    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');

        // Skip rows with too few cells
        if (cells.length < 6) {
            // console.log(`Row ${index}: Skipped (too few cells: ${cells.length})`);
            return;
        }

        let adder = 0;
        if (cells[0] && cells[0].classList.contains("UISTMNumberCell")) {
            adder = 1;
        }

        // More lenient check
        if (cells.length < (6 + adder)) {
            // console.log(`Row ${index}: Skipped (too few cells with adder: ${cells.length}, adder: ${adder})`);
            return;
        }

        const subfolder = sanitizeString(cells[(adder)]?.textContent || '', 100);
        const file_name = validateFileName(cells[(1 + adder)]?.textContent || '');
        const file_comment = sanitizeString(cells[(2 + adder)]?.textContent || '', 500);

        const authorLink = cells[(3 + adder)]?.querySelector('a');
        const author = sanitizeString(
            authorLink ? authorLink.textContent || '' : cells[(3 + adder)]?.textContent || '',
            200
        );

        const date = sanitizeString(cells[(4 + adder)]?.textContent || '', 50);

        // Skip rows with invalid/empty file names
        if (!file_name) {
            return;
        }

        // Look for file links - try multiple cell indices
        let filesCell = cells[(6 + adder)];
        if (!filesCell) {
            filesCell = cells[(5 + adder)]; // Try one cell earlier
        }

        if (!filesCell) {
            // console.log(`Row ${index}: Skipped (no files cell found)`);
            return;
        }

        const fileLinks = filesCell.querySelectorAll('a');
        // console.log(`Row ${index}: Found ${fileLinks.length} file links in cell. Cell content: ${filesCell.innerHTML.substring(0, 50)}...`);

        const extractedFiles: FileAttachment[] = [];
        fileLinks.forEach(link => {
            const img = link.querySelector('img[sysid]');
            let href = link.getAttribute('href') || '';

            // Clean up the link - IS Mendelu uses semicolons in URLs which causes 404s
            // Replace ?; with ? and any remaining ; with &
            href = href.replace(/\?;/g, '?').replace(/;/g, '&');

            // Validate URL before adding
            const validatedUrl = validateUrl(href, 'is.mendelu.cz');
            if (!validatedUrl) {
                console.warn('parseServerFiles: invalid file URL', href);
                return;
            }

            if (img) {
                const sysid = img.getAttribute('sysid') || '';
                const type = sysid.startsWith('mime-') ? sysid.replace('mime-', '') : sysid;

                extractedFiles.push({
                    name: file_name,
                    type: sanitizeString(type, 50),
                    link: validatedUrl
                });
            } else if (href && (href.includes('download') || href.includes('.pl'))) {
                extractedFiles.push({
                    name: file_name || sanitizeString(link.textContent || 'Unknown', 200),
                    type: 'unknown',
                    link: validatedUrl
                });
            }
        });

        if (extractedFiles.length > 0) {
            console.log(`Extracted ${extractedFiles.length} files from row ${index}`);
            files.push({
                subfolder,
                file_name,
                file_comment,
                author,
                date,
                files: extractedFiles
            });
        }
    });

    console.log(`Total files parsed: ${files.length}`);
    return files;
}

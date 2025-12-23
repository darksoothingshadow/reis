/**
 * Parse Server Files
 * 
 * Parses file listings from IS MENDELU document server pages.
 */

import type { ParsedFile, FileAttachment } from '../../types/documents';
import { sanitizeString, validateFileName, validateUrl } from '../../utils/validation';
import { parseHtml } from '../domHelpers';

/**
 * Parse server files HTML to extract file information.
 * Handles both folder listings and individual document pages.
 */
export function parseServerFiles(html: string): { files: ParsedFile[], paginationLinks: string[] } {
    console.debug('[parseServerFiles] Starting parse, HTML length:', html.length);
    const doc = parseHtml(html);
    const files: ParsedFile[] = [];
    const paginationLinks: string[] = [];

    // Check if this is a "Read document" page (detail page)
    const detailPageResult = parseDetailPage(doc);
    if (detailPageResult) {
        return detailPageResult;
    }

    // Parse folder listing
    const rows = findDataRows(doc);
    
    // Extract pagination links
    extractPaginationLinks(doc, paginationLinks);

    // Parse each row
    rows.forEach((row) => {
        const parsedFile = parseFileRow(row);
        if (parsedFile) {
            files.push(parsedFile);
        }
    });

    console.debug('[parseServerFiles] Parse complete. Files:', files.length, ', Pagination:', paginationLinks.length);
    return { files, paginationLinks };
}

/**
 * Parse a document detail page (single file view).
 */
function parseDetailPage(doc: Document): { files: ParsedFile[], paginationLinks: string[] } | null {
    const attachmentsLabel = Array.from(doc.querySelectorAll('td'))
        .find(td => td.textContent?.includes('Attachments:') || td.textContent?.includes('Přílohy:'));
    
    if (!attachmentsLabel) return null;

    const row = attachmentsLabel.parentElement;
    const link = row?.querySelector('a')?.getAttribute('href');

    if (!link) return null;

    // Extract metadata from other rows
    const nameRow = Array.from(doc.querySelectorAll('td'))
        .find(td => td.textContent?.includes('Name:') || td.textContent?.includes('Názov:') || td.textContent?.includes('Název:'))
        ?.parentElement;
    const name = nameRow?.querySelectorAll('td')[1]?.textContent?.trim() || 'Unknown';

    const authorRow = Array.from(doc.querySelectorAll('td'))
        .find(td => td.textContent?.includes('Entered by:') || td.textContent?.includes('Vložil:') || td.textContent?.includes('Zadal:'))
        ?.parentElement;
    const author = authorRow?.querySelectorAll('td')[1]?.textContent?.trim() || '';

    const dateRow = Array.from(doc.querySelectorAll('td'))
        .find(td => td.textContent?.includes('Document date:') || td.textContent?.includes('Datum dokumentu:') || td.textContent?.includes('Dátum dokumentu:'))
        ?.parentElement;
    const date = dateRow?.querySelectorAll('td')[1]?.textContent?.trim() || '';

    const commentRow = Array.from(doc.querySelectorAll('td'))
        .find(td => td.textContent?.includes('Comments:') || td.textContent?.includes('Poznámka:') || td.textContent?.includes('Komentář:'))
        ?.parentElement;
    const comment = commentRow?.querySelectorAll('td')[1]?.textContent?.trim() || '';

    const img = row?.querySelector('img[sysid]');
    const type = img?.getAttribute('sysid')?.replace('mime-', '') || 'unknown';

    // Sanitize extracted metadata
    const sanitizedName = validateFileName(name);
    const sanitizedComment = sanitizeString(comment, 500);
    const sanitizedAuthor = sanitizeString(author, 200);
    const validatedUrl = validateUrl(link, 'is.mendelu.cz');

    if (sanitizedName && validatedUrl) {
        return {
            files: [{
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
            }],
            paginationLinks: []
        };
    }

    return null;
}

/**
 * Find data rows in the document using multiple selector strategies.
 */
function findDataRows(doc: Document): Element[] {
    // Try multiple selectors to find the table rows
    let rows = doc.querySelectorAll('tr.uis-hl-table.lbn');

    if (rows.length === 0) {
        console.debug('[parseServerFiles] No .uis-hl-table.lbn rows, trying .uis-hl-table');
        rows = doc.querySelectorAll('tr.uis-hl-table');
    }

    if (rows.length === 0) {
        // Fallback: select all rows with at least 5 cells
        const allRows = doc.querySelectorAll('table tr');
        const dataRows: Element[] = [];
        allRows.forEach(r => {
            const cells = r.querySelectorAll('td');
            if (cells.length >= 5) {
                dataRows.push(r);
            }
        });
        console.debug('[parseServerFiles] Found', dataRows.length, 'data rows via fallback');
        return dataRows;
    }

    console.debug('[parseServerFiles] Found', rows.length, 'rows via class selector');
    return Array.from(rows);
}

/**
 * Extract pagination links from the document.
 */
function extractPaginationLinks(doc: Document, paginationLinks: string[]): void {
    const allLinks = doc.querySelectorAll('a');
    allLinks.forEach(a => {
        const href = a.getAttribute('href');
        const text = a.textContent?.trim() || '';

        // Check for pagination links (e.g., "11-20", "21-30")
        if (href && href.includes('slozka.pl') && !href.includes('download')) {
            if (text.match(/^\d+-\d+$/)) {
                if (!paginationLinks.includes(href)) {
                    paginationLinks.push(href);
                }
            }
        }
    });
}

/**
 * Parse a single file row.
 */
function parseFileRow(row: Element): ParsedFile | null {
    const cells = row.querySelectorAll('td');

    let adder = 0;
    // Check for checkbox/number column
    if (cells[0] && (cells[0].classList.contains("UISTMNumberCell") || cells[0].querySelector('input[type="checkbox"]'))) {
        adder = 1;
    }

    // Check if row has a link
    const hasLink = Array.from(cells).some(c => 
        c.querySelector('a[href*="download"]') || c.querySelector('a[href*="slozka.pl"]')
    );

    // We need at least 2 cells
    if (cells.length < 2) return null;

    // Skip rows without links and with few cells
    if (!hasLink && cells.length < (5 + adder)) return null;

    const subfolder = sanitizeString(cells[adder]?.textContent || '', 100);
    const nameCell = cells[1 + adder];
    let link = nameCell?.querySelector('a');
    const file_name = validateFileName(nameCell?.textContent || '');

    // If the name cell doesn't have a link, look for it in other cells
    if (!link) {
        const allCells = Array.from(cells);
        const downloadLink = allCells.find(c => c.querySelector('a[href*="download"]'))?.querySelector('a');
        if (downloadLink) {
            link = downloadLink;
        } else {
            const otherLink = allCells.find(c => 
                c.querySelector('a[href*="slozka.pl"]') || c.querySelector('a[href*="dokumenty_cteni.pl"]')
            )?.querySelector('a');
            if (otherLink) {
                link = otherLink;
            }
        }
    }

    if (!link || !file_name) return null;

    const file_comment = sanitizeString(cells[2 + adder]?.textContent || '', 500);

    const authorLink = cells[3 + adder]?.querySelector('a');
    const author = sanitizeString(
        authorLink ? authorLink.textContent || '' : cells[3 + adder]?.textContent || '',
        200
    );

    const date = sanitizeString(cells[4 + adder]?.textContent || '', 50);

    // Extract file attachments
    const extractedFiles = extractFileAttachments(cells, link, file_name);

    if (extractedFiles.length > 0) {
        return {
            subfolder,
            file_name,
            file_comment,
            author,
            date,
            files: extractedFiles
        };
    }

    return null;
}

/**
 * Extract file attachments from row cells.
 */
function extractFileAttachments(cells: NodeListOf<Element>, mainLink: Element, file_name: string): FileAttachment[] {
    const filesCell = cells[cells.length - 1];
    const viewCell = cells[cells.length - 2];

    // Collect links from View and Attach cells
    const potentialLinks: Element[] = [];
    if (viewCell) potentialLinks.push(...Array.from(viewCell.querySelectorAll('a')));
    if (filesCell) potentialLinks.push(...Array.from(filesCell.querySelectorAll('a')));

    // Add main link if not already included
    if (mainLink && !potentialLinks.some(pl => pl.getAttribute('href') === mainLink.getAttribute('href'))) {
        potentialLinks.push(mainLink);
    }

    const extractedFiles: FileAttachment[] = [];

    potentialLinks.forEach(link => {
        const img = link.querySelector('img[sysid]');
        let href = link.getAttribute('href') || '';

        // Fix relative paths
        if (!href.startsWith('http') && !href.startsWith('/')) {
            let cleanHref = href;
            if (cleanHref.startsWith('./')) {
                cleanHref = cleanHref.substring(2);
            }
            if (cleanHref.startsWith('slozka.pl') || cleanHref.startsWith('dokumenty_cteni.pl')) {
                href = `/auth/dok_server/${cleanHref}`;
            }
        }

        const validatedUrl = validateUrl(href, 'is.mendelu.cz');
        if (!validatedUrl) return;

        // Filter out navigation links
        if (isNavigationLink(file_name, link)) return;

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

    return extractedFiles;
}

/**
 * Check if a link is a navigation link (not a file).
 */
function isNavigationLink(file_name: string, link: Element): boolean {
    const navTexts = [
        'Všechny moje složky',
        'Nadřazená složka',
        'Zobrazení dokumentů',
        'Strom od složky'
    ];

    return navTexts.some(text => 
        file_name.includes(text) || link.textContent?.includes(text)
    );
}

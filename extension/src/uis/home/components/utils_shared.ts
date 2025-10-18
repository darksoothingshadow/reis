interface FileAttachment {
  name: string;
  type: string;
  link: string;
}

interface ParsedFile {
  file_name: string;
  author: string;
  date: string;
  files: FileAttachment[];
}

/*interface PaginationInfo {
  currentStart: number;
  currentEnd: number;
  total: number;
  hasMore: boolean;
}*/

/*interface Attachment {
  filename: string;
  downloadUrl: string;
  fileType: string;
  isPrimary: boolean;
}*/

/*interface FileRow {
  id: string;
  name: string;
  comments: string;
  author: string;
  authorId: string;
  documentDate: string;
  modificationDate: string;
  isRead: boolean;
  attachments: Attachment[];
}*/

/*interface Subfolder {
  id: string;
  name: string;
  lastChange: string;
  url: string;
}*/

/*interface SubfolderWithFiles extends Subfolder {
  files: FileRow[];
}*/

/*interface FolderResult {
  files: FileRow[];
  subfolders: SubfolderWithFiles[];
}*/

interface SubjectInfo {
  displayName: string;
  fullName: string;
  subjectCode: string;
  folderUrl: string;
  fetchedAt: string;
}

export interface SubjectsData {
  lastUpdated: string;
  data: Record<string, SubjectInfo>;
}

/*function getParameter(url: string): string | null {
  const pathString = url;
  // 1. Get the part after the '?'
  const queryString = pathString.split('?')[1];

  // 2. Normalize: replace all non-standard semicolons (;) with standard ampersands (&)
  const normalizedQuery = queryString.replace(/;/g, '&');

  // 3. Use the standard URLSearchParams API to parse the string
  const params = new URLSearchParams(normalizedQuery);

  // 4. Get the value
  const id = params.get('id');
  return id;
}*/

export async function fetchServerFilesById(id: string): Promise<string | null> {
  try {
    const result = await fetch("https://is.mendelu.cz/auth/dok_server/vyhledavani.pl", {
      "headers": {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "cs,en;q=0.9,de;q=0.8,pt-BR;q=0.7,pt;q=0.6,sk;q=0.5,es;q=0.4,pl;q=0.3,ru;q=0.2",
        "cache-control": "max-age=0",
        "content-type": "application/x-www-form-urlencoded",
        "sec-ch-ua": "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Opera GX\";v=\"122\"",
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": "\"Android\"",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1"
      },
      "referrer": "https://is.mendelu.cz/auth/dok_server/vyhledavani.pl",
      "body": `text=&_vzorekkdo_vlozil=&kdo_vlozil=0&od=&do=&priloha=0&id_slozky=${id}&najdi=Vyhledat`,
      "method": "POST",
      "mode": "cors",
      "credentials": "include"
    });
    
    if (result.ok) {
      const html_text = await result.text();
      return html_text;
    } else {
      console.error("Result not ok");
      return null;
    }
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function parseServerFiles(html: string): Promise<ParsedFile[]> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rows = doc.querySelectorAll('tr.uis-hl-table.lbn');
  
  const files: ParsedFile[] = [];
  
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    let adder = 0;
    if (cells[0].classList.contains("UISTMNumberCell")) {
      adder = 1;
    }
    console.log(cells.length);
    
    // Skip if we don't have enough cells
    if (cells.length < (7 + adder)) return;
    console.log("Not skipped");
    
    // Extract file name (3rd child - index 2)
    const file_name = cells[(1 + adder)].textContent?.trim() || '';
    
    // Extract author (5th child - index 4)
    const authorLink = cells[(3 + adder)].querySelector('a');
    const author = authorLink ? authorLink.textContent?.trim() || '' : cells[(3 + adder)].textContent?.trim() || '';
    
    // Extract date (6th child - index 5)
    const date = cells[(4 + adder)].textContent?.trim() || '';
    
    // Extract files from 8th child (index 7)
    const filesCell = cells[(6 + adder)];
    const fileLinks = filesCell.querySelectorAll('a');
    
    const extractedFiles: FileAttachment[] = [];
    fileLinks.forEach(link => {
      const img = link.querySelector('img[sysid]');
      if (img) {
        const sysid = img.getAttribute('sysid') || '';
        // Extract file type from sysid (e.g., "mime-pdf" -> "pdf")
        const type = sysid.startsWith('mime-') ? sysid.replace('mime-', '') : sysid;
        
        extractedFiles.push({
          name: file_name,
          type: type,
          link: link.getAttribute('href') || ''
        });
      }
    });
    
    // Only add if we found at least one file
    if (extractedFiles.length > 0) {
      files.push({
        file_name: file_name,
        author: author,
        date: date,
        files: extractedFiles
      });
    }
  });
  console.log("Returning files legitimate");
  return files;
}

/*function parsePaginationInfo(doc: Document): PaginationInfo {
  // Try multiple selectors to find pagination text
  const selectors = [
    'div.small span.small',
    'div.small',
    'span.small'
  ];
  
  for (const selector of selectors) {
    const elements = doc.querySelectorAll(selector);
    
    for (const elem of elements) {
      const text = elem.textContent?.trim() || '';
      
      // Try multiple regex patterns for different text formats
      const patterns = [
        /documents?\s*\((\d+)\s*-\s*(\d+)\s+of\s+(\d+)\)/i,
        /table\s+shows\s+documents?\s*\((\d+)\s*-\s*(\d+)\s+of\s+(\d+)\)/i,
        /(\d+)\s*-\s*(\d+)\s+of\s+(\d+)/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        
        if (match) {
          const currentStart = parseInt(match[1], 10);
          const currentEnd = parseInt(match[2], 10);
          const total = parseInt(match[3], 10);
          
          return {
            currentStart,
            currentEnd,
            total,
            hasMore: currentEnd < total
          };
        }
      }
    }
  }
  
  return { currentStart: 0, currentEnd: 0, total: 0, hasMore: false };
}*/

/*function parseFileRows(doc: Document): FileRow[] {
  const files: FileRow[] = [];
  const table = doc.querySelector(SELECTORS.FILES_TABLE);
  
  if (!table) {
    return files;
  }
  
  const rows = table.querySelectorAll('tbody ' + SELECTORS.FILE_ROW);
  
  rows.forEach((row) => {
    const cells = row.querySelectorAll('td');
    
    if (cells.length < 10) {
      return;
    }
    
    try {
      // Check if this is a file row (has download links in attachments column)
      const attachmentsCell = cells[9];
      const downloadLinks = attachmentsCell.querySelectorAll('a[href*="download="]');
      
      if (downloadLinks.length === 0) {
        return;
      }
      
      // Parse read status (icon in first cell)
      const statusIcon = cells[0].querySelector('img');
      const isRead = statusIcon ? statusIcon.getAttribute('sysid') === 'stav-precteno' : false;
      
      // Parse name
      const name = cells[1].textContent?.trim() || '';
      
      // Parse comments
      const comments = cells[2].textContent?.trim() || '';
      
      // Parse author
      const authorLink = cells[3].querySelector('a');
      const author = authorLink ? authorLink.textContent?.trim() || '' : cells[3].textContent?.trim() || '';
      const authorId = authorLink ? authorLink.getAttribute('href')?.match(/id=(\d+)/)?.[1] || '' : '';
      
      // Parse dates
      const documentDate = cells[4].textContent?.trim() || '';
      const modificationDate = cells[5].textContent?.trim() || '';
      
      // Parse attachments
      const attachments: Attachment[] = [];
      downloadLinks.forEach((link, index) => {
        const img = link.querySelector('img');
        const filename = img ? img.getAttribute('alt') || '' : '';
        const downloadUrl = link.getAttribute('href') || '';
        const fileType = img ? img.getAttribute('sysid')?.replace('mime-', '') || '' : '';
        
        attachments.push({
          filename,
          downloadUrl,
          fileType,
          isPrimary: index === 0
        });
      });
      
      // Extract document ID from download URL
      const firstDownloadUrl = attachments[0]?.downloadUrl || '';
      const docIdMatch = firstDownloadUrl.match(/download=(\d+)/);
      const documentId = docIdMatch ? docIdMatch[1] : '';
      
      files.push({
        id: documentId,
        name,
        comments,
        author,
        authorId,
        documentDate,
        modificationDate,
        isRead,
        attachments
      });
    } catch (err) {
      // Skip invalid rows
    }
  });
  
  return files;
}*/

/*function findNextPageUrl(doc: Document): string | null {
  // This function is referenced but not defined in the original code
  // Adding a placeholder implementation
  const nextLink = doc.querySelector('a[href*="posun="]');
  return nextLink ? nextLink.getAttribute('href') : null;
}*/

/*async function fetchFilesFromFolder(folderUrl: string): Promise<FileRow[]> {
  const allFiles: FileRow[] = [];
  let currentUrl: string | null = folderUrl;
  let pageCount = 0;
  const maxPages = 20;
  
  while (currentUrl && pageCount < maxPages) {
    pageCount++;
    
    const response = await fetch(currentUrl);
    if (!response.ok) {
      break;
    }
    
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    const pageFiles = parseFileRows(doc);
    allFiles.push(...pageFiles);
    
    const paginationInfo = parsePaginationInfo(doc);
    
    if (!paginationInfo.hasMore) {
      break;
    }
    
    const nextPageHref = findNextPageUrl(doc);
    
    if (!nextPageHref) {
      break;
    }
    
    // Build absolute URL for next page using folder URL base
    const baseUrl = new URL(folderUrl);
    const basePath = baseUrl.origin + baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
    currentUrl = basePath + nextPageHref;
  }
  
  return allFiles;
}*/

/*function detectSubfolders(doc: Document): Subfolder[] {
  const subfolders: Subfolder[] = [];
  
  // Look for all tables
  const tables = doc.querySelectorAll('table');
  
  // Find subfolder rows: tr.uis-hl-table.lbn with links to slozka.pl
  for (const table of tables) {
    const rows = table.querySelectorAll('tr.uis-hl-table.lbn');
    if (rows.length === 0) continue;
    
    // Check if these rows contain folder links (slozka.pl)
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) continue;
      
      // Look for link to slozka.pl
      const folderLink = row.querySelector('a[href*="slozka.pl"]');
      if (!folderLink) continue;
      
      // Extract folder info
      const href = folderLink.getAttribute('href') || '';
      const idMatch = href.match(/id=(\d+)/);
      if (!idMatch) continue;
      
      const folderId = idMatch[1];
      const nameCell = cells[1];
      const name = nameCell ? nameCell.textContent?.trim() || '' : '';
      const lastChange = cells[3] ? cells[3].textContent?.trim() || '' : '';
      
      if (folderId && name) {
        subfolders.push({
          id: folderId,
          name,
          lastChange,
          url: href
        });
      }
    }
    
    // If we found subfolders in this table, we're done
    if (subfolders.length > 0) break;
  }
  
  return subfolders;
}*/

/*async function fetchFiles(folderUrl: string, recursive: boolean = true): Promise<FileRow[] | FolderResult> {
  try {
    // Remove ds parameter if present (it changes the view mode)
    // MENDELU uses semicolon-separated params: ?ds=1;id=150956;lang=cz
    let cleanUrl = folderUrl;
    if (folderUrl.includes('ds=')) {
      cleanUrl = folderUrl.replace(/ds=\d+;?/, '');
      cleanUrl = cleanUrl.replace(/;;/g, ';').replace(/;\s*$/, '');
      cleanUrl = cleanUrl.replace(/\?;/, '?');
    }
    
    // Fetch the folder page
    const response = await fetch(cleanUrl);
    if (!response.ok) {
      return [];
    }
    
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    // Check for subfolders
    const subfolders = detectSubfolders(doc);
    
    if (subfolders.length === 0) {
      // Layout 1: No subfolders, just fetch files with pagination
      return await fetchFilesFromFolder(cleanUrl);
    }
    
    // Layout 2: Has subfolders, fetch from each
    const rootFiles = await fetchFilesFromFolder(cleanUrl);
    
    const result: FolderResult = {
      files: rootFiles,
      subfolders: []
    };
    
    for (const subfolder of subfolders) {
      // Build absolute URL for subfolder
      const baseUrl = new URL(cleanUrl);
      const subfolderUrl = baseUrl.origin + baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1) + subfolder.url;
      
      // Fetch files from subfolder using same Layout 1 approach
      const subfolderFiles = await fetchFilesFromFolder(subfolderUrl);
      
      result.subfolders.push({
        id: subfolder.id,
        name: subfolder.name,
        lastChange: subfolder.lastChange,
        url: subfolder.url,
        files: subfolderFiles
      });
    }
    
    return result;
  } catch (error) {
    console.error(error);
    return [];
  }
}*/

const IS_BASE_URL = 'https://is.mendelu.cz/auth';

const ENDPOINTS = {
  SCHEDULE_FORM: '/auth/katalog/rozvrhy_view.pl',
  STUDENT_LIST: '/auth/student/list.pl'
};

const SELECTORS = {
  SCHEDULE_TABLE: '#tmtab_1 tbody',
  SUBJECTS_TABLE: '#tmtab_1',
  SUBJECT_ROW: 'tr.uis-hl-table',
  STUDENT_ID_INPUT: 'input[name="rozvrh_student"]',
  FILES_TABLE: '#tmtab_1',
  FILE_ROW: 'tr.uis-hl-table',
  PAGINATION_TEXT: 'div.small span.small'
};

export async function fetchSubjects(): Promise<Record<string, string>> {
  try {
    const url = ENDPOINTS.STUDENT_LIST + '?lang=cz';
    const response = await fetch(url);
    console.log("Response:", response);
    if (!response.ok) {
      return {};
    }
    const html = await response.text();
    return parseSubjectFolders(html);
  } catch (error) {
    console.error(error);
    return {};
  }
}

function parseSubjectFolders(htmlString: string): Record<string, string> {
  const subjectMap: Record<string, string> = {};
  const doc = new DOMParser().parseFromString(htmlString, 'text/html');
  const table = doc.querySelector(SELECTORS.SUBJECTS_TABLE);
  if (!table) {
    console.log("Returning empty table");
    return subjectMap;
  }
  const subjectRows = table.querySelectorAll(SELECTORS.SUBJECT_ROW);
  subjectRows.forEach((row) => {
    const subjectLinkElement = row.querySelector('a[href*="/auth/katalog/syllabus.pl"]');
    const folderLinkElement = row.querySelector('a[href*="../dok_server/slozka.pl"]');
    if (subjectLinkElement && folderLinkElement) {
      try {
        const subjectName = subjectLinkElement.textContent?.trim() || '';
        const relativeUrl = folderLinkElement.getAttribute('href') || '';
        const cleanUrl = relativeUrl.replace('../', '');
        const absoluteUrl = new URL(cleanUrl, IS_BASE_URL + "/").href;
        subjectMap[subjectName] = absoluteUrl;
      } catch (err) {
        console.error(err);
      }
    }
  });
  console.log("Returning legitimate map");
  return subjectMap;
}

function extractSubjectCode(subjectName: string): string {
  return subjectName.split(" ")[0];
}

export function showFullSubjects(subjectsObject: Record<string, string>): SubjectsData {
  const enrichedSubjects: Record<string, SubjectInfo> = {};
  for (const [fullName, folderUrl] of Object.entries(subjectsObject)) {
    const subjectCode = extractSubjectCode(fullName);
    const displayName = fullName.replace(/\s*\([^)]+\)\s*$/, '').trim();
    enrichedSubjects[subjectCode] = {
      displayName: displayName,
      fullName: fullName,
      subjectCode: subjectCode,
      folderUrl: folderUrl,
      fetchedAt: new Date().toISOString()
    };
  }
  const subjectsData: SubjectsData = {
    lastUpdated: new Date().toISOString(),
    data: enrichedSubjects
  };
  return subjectsData;
}

export async function fetchSchedule(date = new Date()) {
  try {
    const url = ENDPOINTS.SCHEDULE_FORM + '?rozvrh_student_obec=1;lang=cz';
    
    // Step 1: Get student ID
    const initialHtml = await (await fetch(url)).text();
    const doc = new DOMParser().parseFromString(initialHtml, 'text/html');
    
    const studentIdInput = doc.querySelector(SELECTORS.STUDENT_ID_INPUT);
    if (!studentIdInput) {
      return [];
    }
    
    // Step 2: Submit form with date
    const formData = new FormData();
    const dateStr = formatDate(date);
    
    formData.append('konani_od', dateStr);
    formData.append('konani_do', dateStr);
    formData.append('rozvrh_student', (studentIdInput as any).value);
    formData.append('lang', 'cz');
    formData.append('typ_vypisu', 'konani');
    formData.append('format', 'list');
    formData.append('nezvol_all', '2');
    formData.append('poznamky', '1');
    formData.append('poznamky_zmeny', '1');
    formData.append('poznamky_dalsi_ucit', '1');
    formData.append('zobraz', '1');
    formData.append('zobraz2', 'Zobrazit');
    formData.append('rezervace', '0');
    formData.append('poznamky_base', '1');
    formData.append('poznamky_parovani', '1');
    formData.append('poznamky_jiny_areal', '1');
    formData.append('poznamky_dl_omez', '1');

    const resultHtml = await (await fetch(ENDPOINTS.SCHEDULE_FORM, { 
      method: 'POST', 
      body: formData 
    })).text();
    
    const resultDoc = new DOMParser().parseFromString(resultHtml, 'text/html');
    return parseScheduleTable(resultDoc);
  } catch (error) {
    console.error(error);
    return [];
  }
}

function formatDate(date:any) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function parseScheduleTable(resultDoc:any) {
  const events:any = [];
  const scheduleTable = resultDoc.querySelector(SELECTORS.SCHEDULE_TABLE);
  
  if (!scheduleTable) {
    return events;
  }
  
  const eventRows = scheduleTable.querySelectorAll(SELECTORS.SUBJECT_ROW);
  
  eventRows.forEach((row:any) => {
    const cells = row.querySelectorAll('td');
    
    if (cells.length < 9) {
      return;
    }
    
    try {
      const dateTimeText = cells[0].textContent.trim();
      const dateTimeParts = dateTimeText.split(' ');
      
      events.push({
        day: dateTimeParts[0] || '',
        date: dateTimeParts[1] || '',
        startTime: cells[1].textContent.trim(),
        endTime: cells[2].textContent.trim(),
        subject: cells[3].textContent.trim(),
        subjectCode: cells[4].textContent.trim(),
        faculty: cells[5].textContent.trim(),
        type: cells[6].textContent.trim(),
        room: cells[7].textContent.trim(),
        teacher: cells[8].textContent.trim(),
      });
    } catch (err) {
      // Skip invalid rows
    }
  });
  return events;
}


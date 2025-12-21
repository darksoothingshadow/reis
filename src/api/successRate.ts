import { fetchWithAuth, BASE_URL } from "./client";
import { StorageService, STORAGE_KEYS } from "../services/storage";
import type { SubjectSuccessRate, TermStats, SuccessRateData } from "../types/documents";
import { getUserParams } from "../utils/userParams";

const STATS_URL = `${BASE_URL}/auth/student/hodnoceni.pl`;
const MAX_HISTORY_YEARS = 15;
const GLOBAL_STATS_URL = "https://reismendelu.app/static/success-rates-global.json";
const GLOBAL_STATS_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Mappable legacy codes.
 * e.g. EBC-ALG -> ALG, EBC_ALG -> ALG
 */
function getLegacyCodes(currentCode: string): string[] {
    const legacy: string[] = [];
    // EBC-XYZ -> XYZ
    if (currentCode.startsWith('EBC-')) {
        legacy.push(currentCode.replace('EBC-', ''));
    }
    // EBC_XYZ -> XYZ  
    if (currentCode.startsWith('EBC_')) {
        legacy.push(currentCode.replace('EBC_', ''));
    }
    // Add other patterns if known
    return legacy;
}

/**
 * Retrieves success rates from local storage.
 */
export function getStoredSuccessRates(): SuccessRateData | null {
    return StorageService.get<SuccessRateData>(STORAGE_KEYS.SUCCESS_RATES_DATA);
}

/**
 * Saves success rates to local storage.
 */
export function saveSuccessRates(data: SuccessRateData): void {
    StorageService.set(STORAGE_KEYS.SUCCESS_RATES_DATA, data);
}

/**
 * Fetches success rates for the given list of target course codes.
 * Returns a SuccessRateData object and saves it to storage.
 */
export async function fetchSubjectSuccessRates(targetCodes: string[]): Promise<SuccessRateData> {
    console.log(`[SuccessRate] Starting fetch for ${targetCodes.length} courses...`);
    
    // 1. Try to update global cache first
    try {
        await fetchGlobalSuccessRates();
    } catch (e) {
        console.warn('[SuccessRate] Global cache update failed, continuing with existing data:', e);
    }

    // 2. Get existing data (local + global)
    const existing = getStoredSuccessRates();
    const globalData = StorageService.get<SuccessRateData>(STORAGE_KEYS.GLOBAL_SUCCESS_RATES_DATA);
    
    // Resolve dynamic faculty ID
    const params = await getUserParams();
    const facultyId = params?.facultyId || '2'; 
    console.log(`[SuccessRate] Using Faculty ID: ${facultyId}`);
    
    // Create a set of codes that still need fetching (not in local or global cache)
    const missingCodes: string[] = [];
    const results: Record<string, SubjectSuccessRate> = { ...(existing?.data || {}) };

    targetCodes.forEach(code => {
        const hasLocal = results[code] && results[code].stats.length > 0;
        const hasGlobal = globalData?.data[code] && globalData.data[code].stats.length > 0;

        if (!hasLocal) {
            if (hasGlobal) {
                console.log(`[SuccessRate] Found ${code} in global cache`);
                results[code] = globalData!.data[code];
            } else {
                console.log(`[SuccessRate] ${code} missing from all caches, adding to local fetch list`);
                missingCodes.push(code);
            }
        }
    });

    if (missingCodes.length === 0) {
        console.log('[SuccessRate] All codes found in cache, skipping local scraping');
        const finalResult: SuccessRateData = {
            lastUpdated: new Date().toISOString(),
            data: results
        };
        saveSuccessRates(finalResult);
        return finalResult;
    }

    console.log(`[SuccessRate] Falling back to local scraping for ${missingCodes.length} codes: ${missingCodes.join(', ')}`);

    // Create a set of all codes to look for (including legacy)
    const searchSet = new Set<string>();
    missingCodes.forEach(code => {
        searchSet.add(code);
        getLegacyCodes(code).forEach(l => searchSet.add(l));
    });
    
    const currentYear = new Date().getFullYear();

    try {
        // 1. Get main page to find semester links
        const startUrl = `${STATS_URL}?fakulta=${facultyId};lang=cz`;
        const doc = await fetchDocument(startUrl);
        
        if (!doc) throw new Error("Failed to load initial stats page");

        const validSemesters = parseSemesters(doc, currentYear);
        console.log(`[SuccessRate] Found ${validSemesters.length} valid semesters for local scraping`);

        // 3. Process each semester (sequentially)
        for (const sem of validSemesters) {
             console.log(`[SuccessRate] Local Scrape: Processing ${sem.name} (${sem.url})`);
             try {
                 await processSemester(sem, searchSet, results, facultyId, params?.studium);
             } catch (e) {
                 console.error(`[SuccessRate] Local Scrape: Failed to process ${sem.name}:`, e);
             }
        }

        // 4. Transform results (re-link legacy stats to main codes)
        const finalData: Record<string, SubjectSuccessRate> = { ...results };
        
        // Ensure entries for requested codes even if no data found
        targetCodes.forEach(code => {
            if (!finalData[code]) {
                finalData[code] = {
                    courseCode: code,
                    stats: [],
                    lastUpdated: new Date().toISOString()
                };
            }
        });

        // Merge found stats for legacy codes back to main codes
        for (const [foundCode, rate] of Object.entries(results)) {
            const target = targetCodes.find(t => t === foundCode || getLegacyCodes(t).includes(foundCode));
            if (target && target !== foundCode) {
                // If we found data for a legacy code, merge it and remove the legacy entry
                finalData[target].stats = [...(finalData[target].stats || []), ...rate.stats];
                delete finalData[foundCode];
            }
        }

        const finalResult: SuccessRateData = {
            lastUpdated: new Date().toISOString(),
            data: finalData
        };

        // Save to storage
        saveSuccessRates(finalResult);

        return finalResult;

    } catch (error) {
        console.error("[SuccessRate] Critical failure during local scrape fallback:", error);
        throw error;
    }
}

/**
 * Fetches the global success rate cache from the server.
 */
export async function fetchGlobalSuccessRates(): Promise<SuccessRateData | null> {
    const lastSync = StorageService.get<number>(STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC);
    const now = Date.now();

    if (lastSync && (now - lastSync < GLOBAL_STATS_EXPIRY)) {
        console.log('[SuccessRate] Global cache is fresh, skipping fetch');
        return StorageService.get<SuccessRateData>(STORAGE_KEYS.GLOBAL_SUCCESS_RATES_DATA);
    }

    console.log('[SuccessRate] Fetching global success rate cache...');
    try {
        const response = await fetch(GLOBAL_STATS_URL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as SuccessRateData;
        
        StorageService.set(STORAGE_KEYS.GLOBAL_SUCCESS_RATES_DATA, data);
        StorageService.set(STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC, now);
        
        console.log(`[SuccessRate] Global cache updated with statistics for ${Object.keys(data.data).length} courses`);
        return data;
    } catch (e) {
        console.error('[SuccessRate] Failed to fetch global success rates:', e);
        return null;
    }
}

interface SemesterLink {
    name: string;
    url: string;
    year: number;
    id: string; // from obdobi=XXX
}

async function fetchDocument(url: string): Promise<Document | null> {
    console.log(`[SuccessRate DEBUG] fetchDocument: ${url}`);
    const res = await fetchWithAuth(url);
    if (!res.ok) {
        console.log(`[SuccessRate DEBUG] fetchDocument: HTTP ${res.status}`);
        return null;
    }
    const text = await res.text();
    
    // Log first 500 chars to check if we got the right page
    console.log(`[SuccessRate DEBUG] Response preview (${text.length} chars):`, text.substring(0, 500));
    
    // Check for login page redirect
    if (text.includes('login.pl') || text.includes('Přihlášení')) {
        console.warn('[SuccessRate DEBUG] Detected login page - not authenticated!');
    }
    
    const doc = new DOMParser().parseFromString(text, 'text/html');
    console.log(`[SuccessRate DEBUG] Page title: ${doc.title}`);
    
    // Log key elements for debugging
    const table = doc.querySelector('table#tmtab_1');
    console.log(`[SuccessRate DEBUG] table#tmtab_1 found: ${!!table}`);
    
    return doc;
}

function parseSemesters(doc: Document, currentYear: number): SemesterLink[] {
    const list: SemesterLink[] = [];
    const table = doc.querySelector('table#tmtab_1');
    if (!table) {
        console.warn('[SuccessRate] No table#tmtab_1 found');
        return list;
    }
    
    const rows = table.querySelectorAll('tr.uis-hl-table');
    rows.forEach((row, i) => {
        const cells = row.querySelectorAll('td');
        let name = '';
        let href = '';

        // Robust Search: Iterate all cells to find Name (with year) and Link
        cells.forEach(cell => {
            const text = cell.textContent?.trim() || '';
            // 1. Look for year pattern (e.g. 2024/2025)
            if (!name && text.match(/\d{4}\/\d{4}/)) {
                name = text;
            }
            // 2. Look for link with 'obdobi='
            const link = cell.querySelector('a[href*="obdobi="]');
            if (!href && link) {
                href = link.getAttribute('href') || '';
            }
        });

        if (name && href) {
            const yearMatch = name.match(/(\d{4})/);
            if (yearMatch) {
                const year = parseInt(yearMatch[1], 10);
                const isRecent = year >= (currentYear - MAX_HISTORY_YEARS);
                if (isRecent) {
                    const idMatch = href.match(/obdobi=(\d+)/);
                    list.push({
                        name,
                        url: new URL(href, BASE_URL + '/auth/student/').href,
                        year,
                        id: idMatch ? idMatch[1] : '0'
                    });
                }
            }
        } else {
            console.log(`[SuccessRate DEBUG] Row ${i} incomplete: name="${name}", href="${!!href}"`);
        }
    });

    return list;
}

async function processSemester(
    sem: SemesterLink, 
    searchSet: Set<string>, 
    results: Record<string, SubjectSuccessRate>,
    facultyId: string,
    studium?: string
) {
    const doc = await fetchDocument(sem.url);
    if (!doc) return;

    // Find course links
    const courseRows = doc.querySelectorAll('tr.uis-hl-table');
    const matchedCourses: { code: string, url: string }[] = [];

    courseRows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        let foundCode = '';
        let predmetId = '';

        cells.forEach(cell => {
            const text = cell.textContent?.trim() || '';
            // 1. Check if cell text is one of our target codes
            if (!foundCode && searchSet.has(text)) {
                foundCode = text;
            }
            // 2. Look for ANY link with predmet= to extract the subject ID
            const link = cell.querySelector('a[href*="predmet="]');
            if (!predmetId && link) {
                const href = link.getAttribute('href') || '';
                const match = href.match(/predmet=(\d+)/);
                if (match) {
                    predmetId = match[1];
                }
            }
        });
        
        // Construct the correct hodnoceni.pl URL directly
        if (foundCode && predmetId) {
            let statsUrl = `${STATS_URL}?fakulta=${facultyId};obdobi=${sem.id};predmet=${predmetId};lang=cz`;
            if (studium) statsUrl += `;studium=${studium}`;
            
            matchedCourses.push({
                 code: foundCode,
                 url: statsUrl
            });
        }
    });

    console.log(`[SuccessRate] ${sem.name}: Found ${matchedCourses.length} target courses`);

    // Fetch stats for each course
    for (const course of matchedCourses) {
        const statsDoc = await fetchDocument(course.url);
        if (!statsDoc) continue;

        const stats = parseStatsTable(statsDoc);
        if (stats) {
            if (!results[course.code]) {
                results[course.code] = { 
                    courseCode: course.code, 
                    stats: [], 
                    lastUpdated: new Date().toISOString() 
                };
            }
            results[course.code].stats.push({
                semesterName: sem.name,
                semesterId: sem.id,
                year: sem.year,
                totalPass: stats.pass,
                totalFail: stats.fail,
                terms: stats.terms
            });
        }
    }
}

function parseStatsTable(doc: Document): { pass: number, fail: number, terms: TermStats[] } | null {
    const tables = doc.querySelectorAll('table');
    let targetTable: HTMLTableElement | null = null;
    
    for (let i = 0; i < tables.length; i++) {
        const text = tables[i].textContent || '';
        if (text.includes('Termín') && text.includes('zk-nedost')) {
            targetTable = tables[i] as HTMLTableElement;
            break;
        }
    }

    if (!targetTable) {
        console.log('[SuccessRate DEBUG] parseStatsTable: No table found containing "Termín" and "zk-nedost"');
        return null;
    }

    console.log('[SuccessRate DEBUG] parseStatsTable: Target table found.');

    // Header Mapping: Find indices of A, B, C, D, E, F, fail
    const headers: Record<string, number> = {};
    const headerRow = targetTable.querySelector('tr.zahlavi');
    if (headerRow) {
        const ths = headerRow.querySelectorAll('th, td');
        ths.forEach((th, idx) => {
            const text = th.textContent?.trim() || '';
            if (['A', 'B', 'C', 'D', 'E', 'F'].includes(text)) headers[text] = idx;
            if (text.includes('zk-nedost')) headers['fail'] = idx;
            if (text.includes('Termín')) headers['term'] = idx;
        });
    }

    // fallback if headers not found (keeping old logic indices as fallback)
    const getIdx = (key: string, fallback: number) => headers[key] !== undefined ? headers[key] : fallback;
    
    const idxA = getIdx('A', 2);
    const idxB = getIdx('B', 3);
    const idxC = getIdx('C', 4);
    const idxD = getIdx('D', 5);
    const idxE = getIdx('E', 6);
    const idxF = getIdx('F', 7);
    const idxFail = getIdx('fail', 8);
    const idxTerm = getIdx('term', 1);

    let totalPass = 0;
    let totalFail = 0;
    const terms: TermStats[] = [];

    const rows = targetTable.querySelectorAll('tr.uis-hl-table');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const maxIdx = Math.max(idxA, idxB, idxC, idxD, idxE, idxF, idxFail, idxTerm);
        if (cells.length <= maxIdx) return;

        const getVal = (idx: number) => {
            const txt = cells[idx]?.textContent || '0';
            const val = parseInt(txt.trim(), 10);
            return isNaN(val) ? 0 : val;
        };

        const termName = cells[idxTerm]?.textContent?.trim() || '';
        const a = getVal(idxA);
        const b = getVal(idxB);
        const c = getVal(idxC);
        const d = getVal(idxD);
        const e = getVal(idxE);
        const f = getVal(idxF);
        const fail = getVal(idxFail);

        const rowPass = a + b + c + d + e;
        const rowFail = f + fail;

        totalPass += rowPass;
        totalFail += rowFail;

        terms.push({
            term: termName,
            grades: { A: a, B: b, C: c, D: d, E: e, F: f, FN: fail },
            pass: rowPass,
            fail: rowFail
        });
    });

    return { pass: totalPass, fail: totalFail, terms };
}

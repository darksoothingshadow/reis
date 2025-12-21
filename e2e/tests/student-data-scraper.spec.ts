import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Student Subject Data Scraper', () => {
  // Configuration
  const FACULTY_IDS = [2, 14, 23, 38, 60, 220, 631, 79]; 
  const TARGET_COURSES = ['EBC-ALG', 'EBC-AP', 'EBC-KOM', 'PLA', 'KRED', 'EBC-TZI', 'EBC-UICT', 'EBC-ZOO', 'ALG', 'ICT', 'TZI'];
  const MAX_HISTORY_YEARS = 15;
  
  // State
  const results: any[] = [];
  const currentYear = new Date().getFullYear();

  test('scrape subject statistics', async ({ page }) => {
    // Increase timeout for long scraping session
    test.setTimeout(10 * 60 * 1000); // 10 minutes

    console.log(`🚀 Starting scraper (Targeting last ${MAX_HISTORY_YEARS} years)...`);

      // Level 1: Faculty Selection
      console.log(`\n🏫 Level 1: Investigating Faculty Selection Portal...`);
      await page.goto(`https://is.mendelu.cz/auth/student/hodnoceni.pl?lang=cz`);
      
      const pageContent = await page.content();
      if (pageContent.includes('vyber-fakult')) {
          console.log(`   [DEBUG] Found 'vyber-fakult' on landing page.`);
      } else {
          console.log(`   [DEBUG] No 'vyber-fakult' found on landing page.`);
          // Maybe we are already on a faculty page?
      }

      for (const facultyId of FACULTY_IDS) {
        console.log(`\n🏫 Processing Faculty ID: ${facultyId}`);
        await page.goto(`https://is.mendelu.cz/auth/student/hodnoceni.pl?fakulta=${facultyId};lang=cz`);
      
      // If we see a "Select Faculty" list, we might need to handle it
      if (await page.locator('div.vyber-fakult').count() > 0) {
          console.log(`   [DEBUG] Found faculty selection div for ID ${facultyId}`);
          const facultyLink = page.locator(`a[href*="fakulta=${facultyId}"]`);
          if (await facultyLink.count() > 0) {
              await facultyLink.click();
              await page.waitForLoadState('networkidle');
          }
      }

      // Level 2: Semester Selection
      // Locator: table#tmtab_1
      const semesterTable = page.locator('table#tmtab_1');
      if (await semesterTable.count() === 0) {
        console.log(`   ⚠️ No table found for faculty ${facultyId}`);
        const currentUrl = page.url();
        console.log(`   [DEBUG] Current URL: ${currentUrl}`);
        if (facultyId === FACULTY_IDS[0]) { // Only dump first failure to avoid log bloat
            const content = await page.content();
            console.log(`   [DEBUG] Page Content Snippet: ${content.substring(0, 1000)}`);
        }
        continue;
      }

      // Validation: Header must contain "Název období"
      const semesterHeader = semesterTable.locator('tr.zahlavi th').filter({ hasText: 'Název období' });
      if (await semesterHeader.count() === 0) {
        console.log(`   ⚠️ Invalid table format (missing "Název období") for faculty ${facultyId}`);
        continue;
      }

      // Iterate rows
      const semesterRows = semesterTable.locator('tr.uis-hl-table');
      const semesterCount = await semesterRows.count();
      
      // We need to collect links first to avoid stale element errors during navigation
      const semesterLinks: { name: string, url: string }[] = [];

      for (let i = 0; i < semesterCount; i++) {
        const row = semesterRows.nth(i);
        const cells = row.locator('td');
        const cellCount = await cells.count();
        
        let name = '';
        let url = '';

        for (let c = 0; c < cellCount; c++) {
            const text = await cells.nth(c).innerText();
            if (!name && text.match(/\d{4}\/\d{4}/)) {
                name = text.trim();
            }
            const link = cells.nth(c).locator('a[href*="obdobi="]');
            if (!url && await link.count() > 0) {
                url = (await link.getAttribute('href')) || '';
            }
        }

        if (name && url) {
            const yearMatch = name.match(/(\d{4})/);
            if (yearMatch) {
                const year = parseInt(yearMatch[1], 10);
                if (year < (currentYear - MAX_HISTORY_YEARS)) {
                    console.log(`   🛑 Reached history limit (${year}), stopping.`);
                    break;
                }
                const absUrl = new URL(url, page.url()).toString();
                semesterLinks.push({ name, url: absUrl });
            }
        }
      }

      console.log(`   Found ${semesterLinks.length} valid semesters.`);

      // Process Semesters
      for (const semester of semesterLinks) {
        console.log(`   📅 Processing Semester: ${semester.name}`);
        await page.goto(semester.url);

        const courseTable = page.locator('table#tmtab_1');
        if (await courseTable.count() === 0) continue;

        const courseRows = courseTable.locator('tr.uis-hl-table');
        const courseCount = await courseRows.count();
        const courseLinks: { code: string, url: string }[] = [];

        for (let j = 0; j < courseCount; j++) {
            const row = courseRows.nth(j);
            const cells = row.locator('td');
            const cellCount = await cells.count();
            
            let code = '';
            let url = '';

            for (let c = 0; c < cellCount; c++) {
                const text = (await cells.nth(c).innerText()).trim();
                if (!code && TARGET_COURSES.includes(text)) {
                    code = text;
                }
                const links = cells.nth(c).locator('a[href*="hodnoceni.pl"][href*="predmet="][href*="obdobi="]');
                if (await links.count() > 0) {
                    url = (await links.first().getAttribute('href')) || '';
                }
            }

            if (code && url) {
                const absUrl = new URL(url, page.url()).toString();
                courseLinks.push({ code, url: absUrl });
            }
        }

        if (courseLinks.length > 0) {
             console.log(`     Found ${courseLinks.length} target courses.`);
        }

        // Process Courses
        for (const course of courseLinks) {
            console.log(`     📚 Processing Course: ${course.code}`);
            await page.goto(course.url); // Navigate to predmet={id}

             // Level 4: Statistics Extraction
             const statsTable = page.locator('table#tmtab_1');
             if (await statsTable.count() === 0) {
                 console.log(`       ⚠️ No stats table found (skipping).`);
                 continue;
             }

             // Validation: Headers "A", "B", "F"
             const headerRow = statsTable.locator('tr.zahlavi');
             const hasA = await headerRow.locator('th, td', { hasText: 'A' }).count() > 0;
             const hasF = await headerRow.locator('th, td', { hasText: 'F' }).count() > 0;
             
             if (!hasA || !hasF) {
                 console.log('       ⚠️ Stats table validation failed (headers A/F missing).');
                 try {
                     const headerHtml = await headerRow.innerHTML();
                     console.log(`       [DEBUG] Header HTML: ${headerHtml}`);
                 } catch (e) {}
                 continue;
             }

             const statsRows = statsTable.locator('tr.uis-hl-table');
             const statsCount = await statsRows.count();

             let totalPass = 0;
             let totalFail = 0;
             const terms: any[] = [];

             for (let k = 0; k < statsCount; k++) {
                const row = statsRows.nth(k);
                
                const cells = row.locator('td');
                if (await cells.count() < 9) continue;

                const getVal = async (idx: number) => {
                    const txt = await cells.nth(idx).innerText();
                    const val = parseInt(txt.trim(), 10);
                    return isNaN(val) ? 0 : val;
                };

                const termName = (await cells.nth(1).innerText()).trim();
                const a = await getVal(2);
                const b = await getVal(3);
                const c = await getVal(4);
                const d = await getVal(5);
                const e = await getVal(6);
                const f = await getVal(7);
                const fail = await getVal(8);

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
             }

             console.log(`       📊 Stats: Pass=${totalPass}, Fail=${totalFail}`);

             results.push({
                 facultyId,
                 semester: semester.name,
                 course: course.code,
                 totalPass,
                 totalFail,
                 terms,
                 timestamp: new Date().toISOString()
             });

             // Save incrementally
             const outputDir = path.join(__dirname, '..', 'test-results');
             if (!fs.existsSync(outputDir)) {
                 try { fs.mkdirSync(outputDir, { recursive: true }); } catch (e) {}
             }
             const outputPath = path.join(outputDir, 'student-data.json');
             fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
        }
      }
    }

    // Save results
    const outputDir = path.join(__dirname, '..', 'test-results');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, 'student-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Saved ${results.length} records to ${outputPath}`);
    
    // Allow manual inspection if needed (optional, maybe remove for pure CI)
    // await page.pause(); 
  });
});

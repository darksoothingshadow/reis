import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GradeStats {
    A: number; B: number; C: number; D: number; E: number; F: number; FN: number;
}

interface ScraperResult {
    facultyId: number;
    semester: string;
    course: string;
    totalPass: number;
    totalFail: number;
    grades: GradeStats;
    sourceUrl: string;
    timestamp: string;
}

test.describe('Student Subject Data Scraper', () => {
  // Configuration - ALL FACULTIES (correct IDs from MENDELU)
  const ALL_FACULTY_IDS = [2, 14, 23, 38, 60, 220, 631, 79]; // PEF, Agro, FRRMS, LDF, Zahradnická, ICV, CSA, Rektorát
  
  // Support single-faculty scraping via environment variable
  const SCRAPE_FACULTY = process.env.SCRAPE_FACULTY ? parseInt(process.env.SCRAPE_FACULTY, 10) : null;
  const FACULTY_IDS = SCRAPE_FACULTY ? [SCRAPE_FACULTY] : ALL_FACULTY_IDS;
  
  const MAX_SEMESTERS = 5;
  const SCRAPE_ALL_COURSES = true; // Set to false to use TARGET_COURSES filter
  const TARGET_COURSES = ['EBC-ALG', 'EBC-AP', 'EBC-KOM']; // Only used if SCRAPE_ALL_COURSES is false
  
  // State
  const results: ScraperResult[] = [];

  test('scrape subject statistics', async ({ page }) => {
    // Increase timeout for long scraping session (all faculties)
    test.setTimeout(60 * 60 * 1000); // 60 minutes

    console.log(`🚀 Starting scraper (${FACULTY_IDS.length} faculties, last ${MAX_SEMESTERS} semesters${SCRAPE_ALL_COURSES ? ', ALL courses' : ''})...`);

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
            // Just collect all valid semester links, we'll slice to MAX_SEMESTERS later
            const absUrl = new URL(url, page.url()).toString();
            semesterLinks.push({ name, url: absUrl });
        }
      }

      // Limit to MAX_SEMESTERS
      const limitedSemesterLinks = semesterLinks.slice(0, MAX_SEMESTERS);
      console.log(`   Found ${semesterLinks.length} semesters, processing ${limitedSemesterLinks.length}.`);

      // Process Semesters
      for (const semester of limitedSemesterLinks) {
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
                // Extract course code - either all courses or filter by TARGET_COURSES
                if (!code && text.match(/^[A-Z]{2,}-?[A-Z0-9]+$/i)) {
                    if (SCRAPE_ALL_COURSES || TARGET_COURSES.includes(text)) {
                        code = text;
                    }
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
                 } catch { /* ignore */ }
                 continue;
             }
             // --- NEW LOGIC: Parse NVD3 Chart Script for "Všechny termíny" ---
             const pageSource = await page.content();
             
             // Regex to extract the "Všechny termíny" chart data block
             // It's the FIRST d3.select(#graph_X svg).datum([{values: [...]}]) block
             const chartRegex = /d3\.select\('#graph_\d+ svg'\)\s*\.datum\(\[\s*\{\s*values:\s*\[\s*([\s\S]*?)\]\s*}\s*,?\s*\]\)/;
             const match = pageSource.match(chartRegex);
             
             let totalPass = 0;
             let totalFail = 0;
             let uniqueStudents = 0;
             const grades: GradeStats = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, FN: 0 };
             
             if (match && match[1]) {
                 // Parse the values array: { x: 'A', y: 10 }, ...
                 const valuesStr = match[1];
                 const valueRegex = /\{\s*x:\s*['"]([^'"]+)['"],\s*y:\s*(\d+)\s*}/g;
                 let vm;
                 while ((vm = valueRegex.exec(valuesStr)) !== null) {
                     const grade = vm[1];
                     const count = parseInt(vm[2], 10);
                     if (grade === 'A') grades.A = count;
                     else if (grade === 'B') grades.B = count;
                     else if (grade === 'C') grades.C = count;
                     else if (grade === 'D') grades.D = count;
                     else if (grade === 'E') grades.E = count;
                     else if (grade === 'F') grades.F = count;
                     else if (grade === 'zk-nedost' || grade === 'FN' || grade.toLowerCase().includes('nedost')) grades.FN = count;
                     // For "zap/nezap" style courses:
                     else if (grade === 'zap') totalPass = count;
                     else if (grade === 'nezap') totalFail += count;
                     else if (grade === 'zap-nedost') grades.FN = count;
                 }
                 
                 // Calculate pass/fail from ECTS grades if not "zap/nezap"
                 if (totalPass === 0 && (grades.A + grades.B + grades.C + grades.D + grades.E) > 0) {
                     totalPass = grades.A + grades.B + grades.C + grades.D + grades.E;
                     totalFail = grades.F + grades.FN;
                 } else if (totalPass > 0) {
                     // "zap/nezap" style - already set
                     totalFail += grades.FN;
                 }
                 
                 uniqueStudents = totalPass + totalFail;
                 console.log(`       📊 Final Outcome (Unique Students): Pass=${totalPass}, Fail=${totalFail}, N=${uniqueStudents}`);
             } else {
                 console.log(`       ⚠️ Could not find NVD3 chart data, skipping.`);
                 continue;
             }

             results.push({
                 facultyId,
                 semester: semester.name,
                 course: course.code,
                 totalPass,
                 totalFail,
                 grades,
                 sourceUrl: course.url,
                 timestamp: new Date().toISOString()
             });

             // Save incrementally
             const outputDir = path.join(__dirname, '..', 'test-results');
             if (!fs.existsSync(outputDir)) {
                 try { fs.mkdirSync(outputDir, { recursive: true }); } catch { /* ignore */ }
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

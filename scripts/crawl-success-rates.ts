import { chromium } from '@playwright/test';
import { writeFile } from 'fs/promises';
import dotenv from 'dotenv';
import * as db from '../server/db';
import { GradeStats, SemesterStats } from '../server/src/types.js';

// Load environment variables
dotenv.config();


const BASE_URL = 'https://is.mendelu.cz';
const LOGIN_URL = `${BASE_URL}/system/login.pl`;
const STATS_URL = `${BASE_URL}/auth/student/hodnoceni.pl`;

// Correct faculty IDs from user specification
const FACULTIES = [
  { id: '2', name: 'PEF' },
  { id: '14', name: 'Agronomická' },
  { id: '23', name: 'FRRMS' },
  { id: '38', name: 'LDF' },
  { id: '60', name: 'Zahradnická' },
  { id: '220', name: 'ICV' },
  { id: '631', name: 'CSA' },
  { id: '79', name: 'Rektorát' },
];


async function run() {
  const args = process.argv.slice(2);
  const facultyFilter = args.find(a => a.startsWith('--faculty='))?.split('=')[1];
  const resume = args.includes('--resume');
  const limitCount = args.find(a => a.startsWith('--limit='))?.split('=')[1];
  const maxCourses = limitCount ? parseInt(limitCount, 10) : Infinity;

  console.log('🚀 Starting Success Rate Crawler...');
  if (facultyFilter) console.log(`🎯 Filtering by faculty: ${facultyFilter}`);
  if (resume) console.log('♻️  Resume mode enabled');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let scrapedTotal = 0;

  try {
    // 1. Login
    console.log('🔑 Logging in...');
    await page.goto(LOGIN_URL);
    await page.fill('input[name="credential_0"]', process.env.MENDELU_USER || '');
    await page.fill('input[name="credential_1"]', process.env.MENDELU_PASS || '');
    await page.click('input[type="submit"], button[type="submit"]');
    await page.waitForLoadState('networkidle');
    console.log('✅ Logged in successfully');


    // 2. Iterate Faculties
    for (const faculty of FACULTIES) {
      if (facultyFilter && faculty.name !== facultyFilter && faculty.id !== facultyFilter) continue;

      console.log(`\n🏢 Processing Faculty: ${faculty.name} (${faculty.id})`);
      db.upsertFaculty(parseInt(faculty.id, 10), faculty.name);
      
      await page.goto(`${STATS_URL}?fakulta=${faculty.id};lang=cz`);
      await page.waitForLoadState('networkidle');

      // Level 2: Find semesters
      const semesterLinks = await page.evaluate(() => {
        const table = document.querySelector('table#tmtab_1');
        if (!table) return [];
        
        const results: { name: string; url: string; id: string; year: number }[] = [];
        const rows = table.querySelectorAll('tr.uis-hl-table');
        
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length < 5) return;
          
          const nameCell = cells[1];
          const linkCell = cells[4];
          
          const name = nameCell?.textContent?.trim() || '';
          const link = linkCell?.querySelector('a');
          const href = link?.getAttribute('href') || '';
          
          const yearMatch = name.match(/(\d{4})\/\d{4}/);
          const idMatch = href.match(/obdobi=(\d+)/);
          
          if (yearMatch && idMatch) {
            results.push({
              name,
              url: href,
              id: idMatch[1],
              year: parseInt(yearMatch[1], 10)
            });
          }
        });
        return results;
      });

      const validSemesters = semesterLinks.slice(0, 5);
      console.log(`📅 Found ${semesterLinks.length} semesters, processing latest ${validSemesters.length}`);

      for (const sem of validSemesters) {
        console.log(`  🔍 Processing Semester: ${sem.name}`);
        const semesterId = parseInt(sem.id, 10);
        db.upsertSemester(semesterId, parseInt(faculty.id, 10), sem.name, sem.year);
        
        // Clear any poisoned rows from previous incomplete runs
        db.clearIncompleteSuccessRates(semesterId);
        db.markSemesterScraped(semesterId);

        const fullUrl = sem.url.startsWith('http') 
          ? sem.url 
          : `${BASE_URL}/auth/student/${sem.url}`;
        await page.goto(fullUrl);
        await page.waitForLoadState('networkidle');

        // DEBUG: Save first semester HTML for analysis
        if (sem === validSemesters[0]) {
          const semHtml = await page.content();
          await writeFile(`debug-semester-${faculty.id}.html`, semHtml);
          console.log(`    📸 Saved debug-semester-${faculty.id}.html`);
        }

        // Level 3: Find courses
        const courses = await page.evaluate(() => {
          const table = document.querySelector('table#tmtab_1');
          if (!table) return [];
          const results: { code: string; name: string; predmetId: string }[] = [];
          const rows = table.querySelectorAll('tr.uis-hl-table');
          
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;
            
            const code = cells[1]?.textContent?.trim() || '';
            const name = cells[2]?.textContent?.trim() || '';
            let predmetId = '';
            
            const link = row.querySelector('a[href*="predmet="]');
            if (link) {
              const href = link.getAttribute('href') || '';
              const idMatch = href.match(/predmet=(\d+)/);
              if (idMatch) predmetId = idMatch[1];
            }
            
            if (code && predmetId) {
              results.push({ code, name, predmetId });
            }
          });
          return results;
        });

        console.log(`    📚 Found ${courses.length} courses in semester`);

        for (const course of courses) {
          if (scrapedTotal >= maxCourses) break;

          // Check if already scraped in resume mode
          const courseId = db.upsertCourse(course.code, course.name, course.predmetId);
          
          if (resume) {
             // Only skip if stats for this semester are already in the DB AND they have source_url
             const existing = db.getSuccessRatesByCourse(course.code);
             const statsForSem = existing && existing.stats.find((s: SemesterStats) => s.semesterName === sem.name);
             if (statsForSem && statsForSem.sourceUrl) {
                // console.log(`      ⏭️  Skipping ${course.code} (already has stats + sourceUrl)`);
                continue;
             }
          }

          try {
            const statsUrl = `${STATS_URL}?fakulta=${faculty.id};obdobi=${sem.id};predmet=${course.predmetId};lang=cz`;
            await page.goto(statsUrl, { waitUntil: 'domcontentloaded' });

            const pageHtml = await page.content();
            const tableMatch = pageHtml.match(/<table[^>]*id="tmtab_1"[^>]*>[\s\S]*?<\/table>/);
            const tableHtml = tableMatch ? tableMatch[0] : null;

            if (!tableHtml) continue;

            const cleanHtml = tableHtml.replace(/\s+/g, ' ');
            if (!cleanHtml.includes('>A<') || !cleanHtml.includes('>B<') || !cleanHtml.includes('>F<')) {
               continue;
            }

            // Use NVD3 chart parsing for aggregate "Všechny termíny" (Final Outcome)
            const chartRegex = /d3\.select\('#graph_\d+ svg'\)\s*\.datum\(\[\s*\{\s*values:\s*\[\s*([\s\S]*?)\]\s*}\s*,?\s*\]\)/;
            const match = pageHtml.match(chartRegex);
            
            if (match && match[1]) {
                const valuesStr = match[1];
                const valueRegex = /\{\s*x:\s*['"]([^'"]+)['"],\s*y:\s*(\d+)\s*}/g;
                const grades: GradeStats = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, FN: 0 };
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
                    else if (grade === 'zap-nedost') grades.FN = count;
                }

                // Insert as a single "Všechny termíny" record (Final Outcome)
                db.insertSuccessRate(courseId, semesterId, 'Všechny termíny', grades, statsUrl);
                scrapedTotal++;
                console.log(`      ✅ Scraped ${course.code} (N=${Object.values(grades).reduce((a: number, b: number) => a + b, 0)}) [${scrapedTotal}/${maxCourses > 10000 ? '?' : maxCourses}]`);
                db.markCourseScraped(course.code);
            } else {
                // Fallback to table parsing if chart not found (older IS pages or different layout)
                const rowMatches = cleanHtml.match(/<tr class="[^"]*uis-hl-table[^"]*">(.*?)<\/tr>/g);
                if (rowMatches) {
                    let courseHasStats = false;
                    for (const rowHtml of rowMatches) {
                        const cells = rowHtml.match(/<td[^>]*>(.*?)<\/td>/g);
                        if (!cells || cells.length < 9) continue;
                        
                        const getCellText = (cell: string) => cell.replace(/<[^>]*>/g, '').trim();
                        const getCellVal = (cell: string) => {
                            const val = parseInt(getCellText(cell) || '0', 10);
                            return isNaN(val) ? 0 : val;
                        };

                        const termName = getCellText(cells[1]);
                        const grades = {
                            A: getCellVal(cells[2]),
                            B: getCellVal(cells[3]),
                            C: getCellVal(cells[4]),
                            D: getCellVal(cells[5]),
                            E: getCellVal(cells[6]),
                            F: getCellVal(cells[7]),
                            FN: getCellVal(cells[8])
                        };

                        if (grades.A || grades.B || grades.C || grades.D || grades.E || grades.F || grades.FN) {
                            db.insertSuccessRate(courseId, semesterId, termName, grades, statsUrl);
                            courseHasStats = true;
                        }
                    }
                    if (courseHasStats) {
                        scrapedTotal++;
                        console.log(`      ✅ Scraped ${course.code} [${scrapedTotal}/${maxCourses > 10000 ? '?' : maxCourses}]`);
                        db.markCourseScraped(course.code);
                    }
                }
            }
          } catch (e: unknown) {
            console.error(`      ❌ Error processing course ${course.code}:`, e instanceof Error ? e.message : String(e));
          }
        }
        db.markSemesterScraped(semesterId);
        if (scrapedTotal >= maxCourses) break;
      }
      if (scrapedTotal >= maxCourses) break;
    }

    console.log(`\n✨ Finished! Total courses scraped/updated: ${scrapedTotal}`);

  } catch (error) {
    console.error('💥 Fatal error:', error);
  } finally {
    db.closeDb();
    await browser.close();
  }
}

run();

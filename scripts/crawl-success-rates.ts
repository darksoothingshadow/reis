import { chromium } from '@playwright/test';
import { writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'https://is.mendelu.cz';
const LOGIN_URL = `${BASE_URL}/system/login.pl`;
const STATS_URL = `${BASE_URL}/auth/student/hodnoceni.pl`;
const OUTPUT_FILE = join(__dirname, '../public/success-rates-global.json');

const FACULTIES = [
  { id: '1', name: 'AF' },
  { id: '2', name: 'PEF' },
  { id: '3', name: 'LDF' },
  { id: '4', name: 'ZF' },
  { id: '5', name: 'FRRMS' },
  { id: '6', name: 'ICV' }
];

async function run() {
  console.log('🚀 Starting Success Rate Crawler...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Login
    console.log('🔑 Logging in...');
    await page.goto(LOGIN_URL);
    await page.fill('input[name="credential_0"]', process.env.MENDELU_USER || '');
    await page.fill('input[name="credential_1"]', process.env.MENDELU_PASS || '');
    await page.click('input[name="prihlasit"]');
    await page.waitForURL(/auth/);
    console.log('✅ Logged in successfully');

    const globalData: Record<string, any> = {};

    // 2. Iterate Faculties
    for (const faculty of FACULTIES) {
      console.log(`\n🏢 Processing Faculty: ${faculty.name} (${faculty.id})`);
      await page.goto(`${STATS_URL}?fakulta=${faculty.id};lang=cz`);

      // Find semesters
      const semesterLinks = await page.locator('table#tmtab_1 tr.uis-hl-table').evaluateAll(rows => 
        rows.map(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          const yearCell = cells.find(c => c.textContent?.match(/\d{4}\/\d{4}/));
          const link = row.querySelector('a[href*="obdobi="]');
          if (yearCell && link) {
             const yearText = yearCell.textContent?.trim() || '';
             const year = parseInt(yearText.match(/(\d{4})/)![1]);
             return {
               name: yearText,
               url: link.getAttribute('href'),
               id: link.getAttribute('href')?.match(/obdobi=(\d+)/)?.[1],
               year
             };
          }
          return null;
        }).filter(s => s && s.year >= new Date().getFullYear() - 5)
      );

      console.log(`📅 Found ${semesterLinks.length} relevant semesters`);

      for (const sem of semesterLinks) {
        if (!sem) continue;
        console.log(`  🔍 Processing Semester: ${sem.name}`);
        await page.goto(`${BASE_URL}${sem.url}`);

        // Find courses
        const courses = await page.locator('table#tmtab_1 tr.uis-hl-table').evaluateAll(rows => 
          rows.map(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            const codeCell = cells[0]; // Usually first cell is code
            const link = row.querySelector('a[href*="predmet="]');
            if (codeCell && link) {
              const code = codeCell.textContent?.trim() || '';
              const predmetId = link.getAttribute('href')?.match(/predmet=(\d+)/)?.[1];
              return { code, predmetId };
            }
            return null;
          }).filter(c => c !== null)
        );

        console.log(`    📚 Found ${courses.length} courses`);

        for (const course of courses) {
          if (!course) continue;
          
          try {
            // Check if we already have this course in globalData
            if (!globalData[course.code]) {
              globalData[course.code] = {
                courseCode: course.code,
                stats: [],
                lastUpdated: new Date().toISOString()
              };
            }

            // Construct stats URL
            const statsUrl = `${STATS_URL}?fakulta=${faculty.id};obdobi=${sem.id};predmet=${course.predmetId};lang=cz`;
            await page.goto(statsUrl);

            // Parse Grade Table
            const stats = await page.evaluate(() => {
              const tables = Array.from(document.querySelectorAll('table'));
              const targetTable = tables.find(t => 
                t.textContent?.includes('Termín') && t.textContent?.includes('zk-nedost')
              );

              if (!targetTable) return null;

              const headers: Record<string, number> = {};
              const headerRow = targetTable.querySelector('tr.zahlavi');
              if (headerRow) {
                Array.from(headerRow.querySelectorAll('th, td')).forEach((th, idx) => {
                  const text = th.textContent?.trim() || '';
                  if (['A', 'B', 'C', 'D', 'E', 'F'].includes(text)) headers[text] = idx;
                  if (text.includes('zk-nedost')) headers['fail'] = idx;
                  if (text.includes('Termín')) headers['term'] = idx;
                });
              }

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
              const terms: any[] = [];

              targetTable.querySelectorAll('tr.uis-hl-table').forEach(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                if (cells.length < 9) return;

                const getVal = (idx: number) => {
                  const val = parseInt(cells[idx]?.textContent?.trim() || '0', 10);
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
            });

            if (stats) {
              globalData[course.code].stats.push({
                semesterName: sem.name,
                semesterId: sem.id,
                year: sem.year,
                totalPass: stats.pass,
                totalFail: stats.fail,
                terms: stats.terms
              });
            }
          } catch (e) {
            console.error(`      ❌ Error processing course ${course.code}:`, e);
          }
        }
      }
    }

    // 3. Save to JSON
    const finalResult = {
      lastUpdated: new Date().toISOString(),
      data: globalData
    };

    console.log(`\n💾 Saving statistics for ${Object.keys(globalData).length} courses...`);
    await writeFile(OUTPUT_FILE, JSON.stringify(finalResult, null, 2));
    console.log(`✨ Successfully saved to ${OUTPUT_FILE}`);

  } catch (error) {
    console.error('💥 Fatal error:', error);
  } finally {
    await browser.close();
  }
}

run();

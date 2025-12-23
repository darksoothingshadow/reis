import { describe, it, beforeAll, afterAll } from '@serenity-js/playwright-test';
import { actorCalled, engage, Duration, Wait, Interaction } from '@serenity-js/core';
import { Click, PageElement, By } from '@serenity-js/web';
import { BrowseTheWebWithPlaywright } from '@serenity-js/playwright';
import { ExtensionCast, createExtensionContext } from '../actors';
import { OpenExtensionPopup, WaitForHydration } from '../tasks';
import { BrowserContext } from '@playwright/test';
import { calculateExtensionId } from '../../utils/id';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Success Rate Tab', () => {
    let context: BrowserContext;
    
    const manifestPath = path.resolve(__dirname, '../../../public/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const EXTENSION_ID = calculateExtensionId(manifest.key);

    interface MockStats {
        [courseCode: string]: {
            courseCode: string;
            lastUpdated: string;
            stats: Array<{
                semesterName: string;
                semesterId: string;
                year: number;
                totalPass: number;
                totalFail: number;
                terms: Array<{
                    term: string;
                    grades: Record<string, number>;
                    pass: number;
                    fail: number;
                }>;
            }>;
        };
    }

    interface MockScheduleItem {
        id: string;
        courseCode: string;
        courseName: string;
        courseId: string;
        date: string;
        startTime: string;
        endTime: string;
        room: string;
        teachers: Array<{ fullName: string; shortName: string; id: string }>;
        isSeminar: string;
    }

    const mockStats: MockStats = {
        "EBC-ALG": {
            "courseCode": "EBC-ALG",
            "lastUpdated": new Date().toISOString(),
            "stats": [
                {
                    "semesterName": "Zima",
                    "semesterId": "2023-Z",
                    "year": 2023,
                    "totalPass": 85,
                    "totalFail": 15,
                    "terms": [
                        {
                            "term": "Řádný",
                            "grades": { "A": 10, "B": 15, "C": 20, "D": 20, "E": 20, "F": 10, "FN": 5 },
                            "pass": 85,
                            "fail": 15
                        }
                    ]
                },
                {
                    "semesterName": "Léto",
                    "semesterId": "2023-L",
                    "year": 2023,
                    "totalPass": 40,
                    "totalFail": 60,
                    "terms": [
                        {
                            "term": "Řádný",
                            "grades": { "A": 2, "B": 3, "C": 5, "D": 10, "E": 20, "F": 40, "FN": 20 },
                            "pass": 40,
                            "fail": 60
                        }
                    ]
                }
            ]
        }
    };

    const mockSchedule: MockScheduleItem[] = [
        {
            "id": "1",
            "courseCode": "EBC-ALG",
            "courseName": "Algoritmy",
            "courseId": "12345",
            "date": new Date().toISOString().split('T')[0].replace(/-/g, ''),
            "startTime": "08:00",
            "endTime": "09:30",
            "room": "Q01",
            "teachers": [{ "fullName": "John Doe", "shortName": "Doe J.", "id": "1" }],
            "isSeminar": "false"
        }
    ];

    beforeAll(async () => {
        context = await createExtensionContext();
        engage(new ExtensionCast(context));
    });

    afterAll(async () => {
        if (context) {
            await context.close();
        }
    });

    it('visual audit', async () => {
        const Charlie = actorCalled('Charlie');

        await Charlie.attemptsTo(
            OpenExtensionPopup(EXTENSION_ID),
            WaitForHydration(),
            
            // Inject mock data
            Interaction.where('#actor injects mock data', async (actor) => {
                const page = await (BrowseTheWebWithPlaywright.as(actor) as unknown as { currentPage: () => Promise<{ nativePage: () => Promise<{ evaluate: (fn: (args: { stats: MockStats, schedule: MockScheduleItem[] }) => void, args: { stats: MockStats, schedule: MockScheduleItem[] }) => Promise<void> }> }> }).currentPage();
                const nativePage = await page.nativePage();
                await nativePage.evaluate(({ stats, schedule }: { stats: MockStats, schedule: MockScheduleItem[] }) => {
                    localStorage.setItem('reis_success_rates', JSON.stringify({ data: stats, lastUpdated: new Date().toISOString() }));
                    localStorage.setItem('reis_schedule', JSON.stringify(schedule));
                    window.location.reload();
                }, { stats: mockStats, schedule: mockSchedule });
            }),
            
            WaitForHydration(),
            Wait.for(Duration.ofMilliseconds(1000)),

            // Open the subject drawer
            Click.on(PageElement.located(By.css('[data-testid="calendar-event-card"]'))),
            Wait.for(Duration.ofMilliseconds(500)),
            
            // Switch to Stats tab
            Click.on(PageElement.located(By.css('[data-testid="tab-stats"]'))),
            Wait.for(Duration.ofMilliseconds(1000)),
            
            // Take screenshots for visual verification
            Interaction.where('#actor takes screenshots', async (actor) => {
                const page = await (BrowseTheWebWithPlaywright.as(actor) as unknown as { currentPage: () => Promise<{ nativePage: () => Promise<{ screenshot: (options: { path: string, fullPage: boolean }) => Promise<void>; waitForTimeout: (timeout: number) => Promise<void>; evaluate: (fn: () => void) => Promise<void> }> }> }).currentPage();
                const nativePage = await page.nativePage();
                
                // Ensure artifacts directory is accessible
                const artifactsPath = path.resolve(process.cwd(), 'artifacts');
                if (!fs.existsSync(artifactsPath)) fs.mkdirSync(artifactsPath, { recursive: true });

                await nativePage.screenshot({ path: path.join(artifactsPath, 'success_rate_light.png'), fullPage: true });
                
                // Toggle Dark Mode
                await nativePage.evaluate(() => {
                    document.documentElement.setAttribute('data-theme', 'mendelu-dark');
                });
                await nativePage.waitForTimeout(1000);
                await nativePage.screenshot({ path: path.join(artifactsPath, 'success_rate_dark.png'), fullPage: true });
            })
        );
    });
});

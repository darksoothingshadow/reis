import { test, expect } from '../fixtures/extension';

const MOCK_GLOBAL_DATA = {
  lastUpdated: new Date().toISOString(),
  data: {
    'MOCK-101': {
      courseCode: 'MOCK-101',
      stats: [
        {
          semesterName: 'ZS 2024/2025',
          semesterId: '123',
          year: 2024,
          totalPass: 85,
          totalFail: 15,
          terms: [
            {
              term: '1. řádný',
              grades: { A: 15, B: 20, C: 20, D: 15, E: 15, F: 10, FN: 5 },
              pass: 85,
              fail: 15
            }
          ]
        }
      ],
      lastUpdated: new Date().toISOString()
    }
  }
};

const MOCK_SEARCH_HTML = `
<html>
<body>
  <div id="hledani_vysledky">
    <span style="background-color: #10b981"></span>
    <a href="../katalog/syllabus.pl?predmet=101;lang=cz">MOCK-101 Mocked Subject</a> - PEF
  </div>
</body>
</html>
`;

test.describe('Global Success Rate Cache', () => {
  test.beforeEach(async ({ extensionContext, extensionPage }) => {
    // 1. Mock Network
    await extensionContext.route(/success-rates-global\.json/, async route => {
      console.log(`[MOCK] GLOBAL CACHE: ${route.request().url()}`);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_GLOBAL_DATA),
      });
    });

    await extensionContext.route('**/auth/hledani/index.pl*', async route => {
      console.log(`[MOCK] SEARCH: ${route.request().url()}`);
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: MOCK_SEARCH_HTML,
      });
    });

    // Log console
    extensionPage.on('console', msg => {
        const text = msg.text();
        if (text.includes('SuccessRate') || text.includes('SearchBar') || text.includes('App')) {
            console.log(`[EXTENSION] ${text}`);
        }
    });
  });

  test('displays stats from global cache after search selection', async ({ extensionPage }) => {
    console.log('[TEST] Waiting for Extension UI...');
    
    // Debug: capture console logs from the extension page
    extensionPage.on('console', msg => console.log(`[BROWSER] ${msg.type().toUpperCase()}: ${msg.text()}`));
    
    // The placeholder is actually "Prohledej reIS"
    const searchInput = extensionPage.locator('input[placeholder*="Prohledej"]');
    await expect(searchInput).toBeVisible({ timeout: 30000 });

    // 1. Search for subject
    console.log('[TEST] Searching for MOCK...');
    await searchInput.fill('MOCK');
    
    // 2. Wait for and click search result
    console.log('[TEST] Waiting for search results...');
    const result = extensionPage.locator('text=Mocked Subject');
    await expect(result).toBeVisible({ timeout: 10000 });
    await result.click();

    // 3. Wait for Drawer to open
    console.log('[TEST] Waiting for Drawer...');
    const drawerHeader = extensionPage.locator('.text-xl.font-bold').filter({ hasText: /Mocked Subject/ });
    await expect(drawerHeader).toBeVisible({ timeout: 10000 });

    // 4. Click the "Úspěšnost" tab in the drawer
    console.log('[TEST] Clicking stats tab...');
    const statsTabButton = extensionPage.getByRole('button', { name: /Úspěšnost/i });
    await expect(statsTabButton).toBeVisible();
    await statsTabButton.click();
    
    // 5. Check UI (pass rate 85% from MOCK_GLOBAL_DATA)
    console.log('[TEST] Verifying stats...');
    // We expect "85%" to appear in the stats tab
    await expect(extensionPage.locator('text=85%')).toBeVisible({ timeout: 15000 });
    
    // Check for "Globální cache" text in footer
    await expect(extensionPage.locator('text=/Globální cache/i')).toBeVisible();

    console.log('✅ Global Success Rate Cache test (Search Flow) passed!');
  });
});

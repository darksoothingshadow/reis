/**
 * E2E tests for Success Rate tab in file drawer
 */
import { test, expect } from '../fixtures/extension';

test.describe('Success Rate Tab', () => {
  test('can switch to success rate tab and see data', async ({ extensionPage }) => {
    // 1. Mock the Success Rate API
    await extensionPage.route('**/api/success-rates*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          lastUpdated: new Date().toISOString(),
          data: {
            'EBC-ALG': {
              courseCode: 'EBC-ALG',
              stats: [
                {
                  semesterName: 'LS 2024/2025 - PEF',
                  year: 2024,
                  totalPass: 10,
                  totalFail: 5,
                  terms: [
                    {
                      term: 'termín 1',
                      pass: 10,
                      fail: 5,
                      grades: { A: 2, B: 2, C: 2, D: 2, E: 2, F: 5, FN: 0 }
                    }
                  ]
                }
              ],
              lastUpdated: new Date().toISOString()
            }
          }
        })
      });
    });

    // 2. Mock the Global Search API to return a subject
    await extensionPage.route('**/auth/hledani/index.pl*', async (route) => {
      // Return a minimal HTML with a syllabus link that parseSubjectResults will find
      const mockHtml = `
        <html>
          <body>
            <span style="background-color: #ff0000">PEF</span>
            <a href="../katalog/syllabus.pl?predmet=123456">EBC-ALG Algoritmy</a>
            <span> - ZS 2024/2025 - PEF</span>
          </body>
        </html>
      `;
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: mockHtml
      });
    });

    // 3. Search for the subject
    const searchInput = extensionPage.locator('input[placeholder*="Hledat"], input[aria-label="Vyhledávání"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('Algoritmy');
    await extensionPage.keyboard.press('Enter');
    
    // 3. Wait for and click result
    const resultItem = extensionPage.locator('[data-testid="search-result-item"]').first();
    await expect(resultItem).toBeVisible({ timeout: 5000 });
    await resultItem.click();
    
    // 4. Navigate to success rate tab in drawer
    const statsTabButton = extensionPage.locator('button', { hasText: /Úspěšnost/i });
    await expect(statsTabButton).toBeVisible();
    await statsTabButton.click();
    
    // 5. Verify stats content is visible
    const statsContent = extensionPage.locator('text=/Rozdělení známek|statist/i');
    await expect(statsContent.first()).toBeVisible();
  });
});

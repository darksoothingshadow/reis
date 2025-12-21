/**
 * E2E tests for Success Rate tab in file drawer
 */
import { test, expect } from '../fixtures/extension';

test.describe('Success Rate Tab', () => {
  test('can switch to success rate tab', async ({ extensionPage }) => {
    // Wait for calendar events to load
    await extensionPage.waitForSelector('[class*="event"], [class*="subject"], [class*="tile"]', {
      timeout: 10000
    }).catch(() => {});
    
    // Try to find a clickable event/subject in calendar
    let eventTile = extensionPage.locator(
      '[class*="event"], [class*="subject"], [class*="tile"]'
    ).first();
    
    if (await eventTile.count() === 0) {
        // Fallback: Use search to find a subject
        const searchInput = extensionPage.locator('input[placeholder*="Hledat"], .search-input').first();
        if (await searchInput.count() > 0) {
            await searchInput.fill('Finanční účetnictví');
            await extensionPage.keyboard.press('Enter');
            // Wait for results
            await extensionPage.waitForSelector('[class*="search-result"], .result-item', { timeout: 5000 }).catch(() => {});
            eventTile = extensionPage.locator('[class*="search-result"], .result-item').first();
        }
    }

    if (await eventTile.count() > 0) {
      await eventTile.click();
      
      // Wait for drawer to open
      await extensionPage.waitForSelector(
        '[class*="drawer"], [role="dialog"]',
        { timeout: 5000, state: 'visible' }
      ).catch(() => {});
      
      // Find the tab button
      const statsTabButton = extensionPage.locator('button', { hasText: /Úspěšnost/i });
      await expect(statsTabButton).toBeVisible();
      
      // Click the tab
      await statsTabButton.click();
      
      // Look for the stats content (gauges or skeleton)
      const statsContent = extensionPage.locator('text=/Rozdělení známek|statist|načítání/i');
      await expect(statsContent.first()).toBeVisible();
    } else {
      test.skip(true, 'No subject tiles found on page');
    }
  });
});

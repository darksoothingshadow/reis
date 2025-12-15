/**
 * Visual regression tests for Calendar view
 */
import { test, expect } from '../../fixtures/extension';

test.describe('Visual: Calendar', () => {
  test('calendar view matches baseline', async ({ extensionPage }) => {
    // Wait for calendar to fully render
    await extensionPage.waitForLoadState('networkidle');
    await extensionPage.waitForTimeout(2000);

    // Compare against baseline
    await expect(extensionPage).toHaveScreenshot('calendar-default.png', {
      fullPage: true,
    });
  });

  test('calendar with event selected', async ({ extensionPage }) => {
    await extensionPage.waitForLoadState('networkidle');
    
    // Click on first calendar event if available
    const event = extensionPage.locator('[class*="event"], [class*="subject"]').first();
    if (await event.count() > 0) {
      await event.click();
      await extensionPage.waitForTimeout(500);
      
      await expect(extensionPage).toHaveScreenshot('calendar-event-selected.png', {
        fullPage: true,
      });
    }
  });
});

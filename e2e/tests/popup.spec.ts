/**
 * E2E tests for extension popup UI
 */
import { test, expect } from '../fixtures/extension';

test.describe('Popup UI', () => {
  test('popup loads without errors', async ({ extensionPage }) => {
    // Check page loaded
    await expect(extensionPage).toHaveTitle(/reIS|Reis/i);
    
    // No console errors
    const errors: string[] = [];
    extensionPage.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait for React to hydrate
    await extensionPage.waitForTimeout(2000);
    
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('sidebar renders with navigation items', async ({ extensionPage }) => {
    // Wait for sidebar to load
    const sidebar = extensionPage.locator('[class*="sidebar"], aside, nav').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
    
    // Check for key navigation items
    const navItems = await extensionPage.locator('a, button').allTextContents();
    const hasHomeOrCalendar = navItems.some(text => 
      /domů|home|kalendář|calendar/i.test(text)
    );
    expect(hasHomeOrCalendar).toBe(true);
  });

  test('calendar view displays', async ({ extensionPage }) => {
    // Look for calendar-related elements
    const calendarElements = extensionPage.locator(
      '[class*="calendar"], [class*="week"], [class*="schedule"]'
    );
    
    // At least one calendar element should exist
    const count = await calendarElements.count();
    expect(count).toBeGreaterThan(0);
  });
});

/**
 * E2E tests for search functionality
 */
import { test, expect } from '../fixtures/extension';

test.describe('Search Bar', () => {
  test('search bar is visible and focusable', async ({ extensionPage }) => {
    // Find search input
    const searchInput = extensionPage.locator(
      'input[type="search"], input[type="text"][placeholder*="hled"], [class*="search"] input'
    ).first();
    
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    
    // Should be focusable
    await searchInput.focus();
    await expect(searchInput).toBeFocused();
  });

  test('typing in search shows results', async ({ extensionPage }) => {
    const searchInput = extensionPage.locator(
      'input[type="search"], input[type="text"][placeholder*="hled"], [class*="search"] input'
    ).first();
    
    await searchInput.fill('test');
    
    // Wait for results to appear
    await extensionPage.waitForTimeout(1000);
    
    // Results container should appear
    const resultsContainer = extensionPage.locator(
      '[class*="result"], [class*="dropdown"], [class*="suggestion"], [role="listbox"]'
    );
    
    // Either results appear or empty state
    const hasResults = await resultsContainer.count() > 0;
    const hasEmptyState = await extensionPage.locator('text=/žádné|no results|nenalezeno/i').count() > 0;
    
    expect(hasResults || hasEmptyState).toBe(true);
  });

  test('search can be cleared', async ({ extensionPage }) => {
    const searchInput = extensionPage.locator(
      'input[type="search"], input[type="text"][placeholder*="hled"], [class*="search"] input'
    ).first();
    
    await searchInput.fill('test query');
    await expect(searchInput).toHaveValue('test query');
    
    // Clear the input
    await searchInput.clear();
    await expect(searchInput).toHaveValue('');
  });
});

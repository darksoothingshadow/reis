/**
 * Visual regression tests for Search functionality
 */
import { test, expect } from '../../fixtures/extension';

test.describe('Visual: Search', () => {
  test('search results match baseline', async ({ extensionPage }) => {
    await extensionPage.waitForLoadState('networkidle');
    
    // Find and interact with search
    const searchInput = extensionPage.locator('input[type="text"], input[placeholder*="Hledat"]');
    await searchInput.fill('Matematika');
    await extensionPage.waitForTimeout(1500); // Wait for results
    
    await expect(extensionPage).toHaveScreenshot('search-results.png', {
      fullPage: true,
    });
  });

  test('empty search state', async ({ extensionPage }) => {
    await extensionPage.waitForLoadState('networkidle');
    
    // Focus search without typing
    const searchInput = extensionPage.locator('input[type="text"], input[placeholder*="Hledat"]');
    await searchInput.focus();
    await extensionPage.waitForTimeout(300);
    
    await expect(extensionPage).toHaveScreenshot('search-focused-empty.png', {
      fullPage: true,
    });
  });

  test('search with no results', async ({ extensionPage }) => {
    await extensionPage.waitForLoadState('networkidle');
    
    const searchInput = extensionPage.locator('input[type="text"], input[placeholder*="Hledat"]');
    await searchInput.fill('xyznonexistent123');
    await extensionPage.waitForTimeout(1000);
    
    await expect(extensionPage).toHaveScreenshot('search-no-results.png', {
      fullPage: true,
    });
  });
});

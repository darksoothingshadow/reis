import { test, expect } from '../fixtures/extension';

test.describe('Visual Proof Search', () => {
  test('capture search state', async ({ extensionPage }) => {
    const searchInput = extensionPage.locator('input[type="text"], input[placeholder*="Hledat"]');
    await searchInput.fill('Matematika');
    await extensionPage.waitForTimeout(2000); // Wait for results
    await extensionPage.screenshot({ path: 'proof-search.png', fullPage: true });
    console.log('📸 Captured proof-search.png');
  });
});

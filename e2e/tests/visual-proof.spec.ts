import { test, expect } from '../fixtures/extension';

test.describe('Visual Proof', () => {
  test('capture application state screenshots', async ({ extensionPage }) => {
    // 1. Calendar View (Default)
    await extensionPage.waitForLoadState('networkidle');
    await extensionPage.waitForTimeout(2000); // Wait for animations
    await extensionPage.screenshot({ path: 'proof-calendar.png', fullPage: true });
    console.log('📸 Captured proof-calendar.png');

    // 2. Exam Timeline
    const examButton = extensionPage.getByText(/zkoušk|exam|termín/i).first();
    if (await examButton.count() > 0) {
        await examButton.click();
        await extensionPage.waitForTimeout(2000);
        await extensionPage.screenshot({ path: 'proof-exams.png', fullPage: true });
        console.log('📸 Captured proof-exams.png');
        
        // Go back
        await extensionPage.getByText(/rozvrh/i).first().click();
    }

    // 3. Search
    const searchInput = extensionPage.locator('input[type="text"], input[placeholder*="Hledat"]');
    await searchInput.fill('Matematika');
    await extensionPage.waitForTimeout(1000); // Wait for results
    await extensionPage.screenshot({ path: 'proof-search.png', fullPage: true });
    console.log('📸 Captured proof-search.png');
  });
});

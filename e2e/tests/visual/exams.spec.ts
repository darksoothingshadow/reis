/**
 * Visual regression tests for Exam Timeline
 */
import { test, expect } from '../../fixtures/extension';

test.describe('Visual: Exams', () => {
  test.beforeEach(async ({ extensionPage }) => {
    await extensionPage.waitForLoadState('networkidle');
    
    // Navigate to exam view
    const examButton = extensionPage.getByText(/zkoušk|exam|termín/i).first();
    if (await examButton.count() > 0) {
      await examButton.click();
      await extensionPage.waitForTimeout(1500);
    }
  });

  test('exam timeline matches baseline', async ({ extensionPage }) => {
    await expect(extensionPage).toHaveScreenshot('exams-timeline.png', {
      fullPage: true,
    });
  });

  test('exam timeline with hover state', async ({ extensionPage }) => {
    // Hover over first exam box if available
    const examBox = extensionPage.locator('[class*="exam"]').first();
    if (await examBox.count() > 0) {
      await examBox.hover();
      await extensionPage.waitForTimeout(300);
      
      await expect(extensionPage).toHaveScreenshot('exams-hover.png', {
        fullPage: true,
      });
    }
  });
});

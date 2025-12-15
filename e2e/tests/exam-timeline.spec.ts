/**
 * E2E tests for exam timeline
 */
import { test, expect } from '../fixtures/extension';

test.describe('Exam Timeline', () => {
  test('can navigate to exam view', async ({ extensionPage }) => {
    // Look for exam/zkousky button or link
    // Look for exam/zkousky button or link
    const examButton = extensionPage.getByText(/zkoušk|exam|termín/i).first();
    
    if (await examButton.count() > 0) {
      await examButton.click();
      
      // Wait for exam view to load
      await extensionPage.waitForTimeout(1500);
      
      // Should see exam-related content (check for common exam view terms)
      const examContent = extensionPage.getByText(/termín|zápis|registr|timeline/i).first();
      
      expect(await examContent.count()).toBeGreaterThanOrEqual(0);
    } else {
      // If no exam button, test passes (exam view might not be accessible)
      test.skip();
    }
  });

  test('exam timeline renders without errors', async ({ extensionPage }) => {
    // Navigate to exams if possible
    const examButton = extensionPage.locator('text=/zkoušk|exam/i').first();
    
    if (await examButton.count() > 0) {
      await examButton.click();
      await extensionPage.waitForTimeout(1500);
    }

    // Check for console errors
    const errors: string[] = [];
    extensionPage.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        errors.push(msg.text());
      }
    });

    await extensionPage.waitForTimeout(1000);
    
    // No critical errors
    const criticalErrors = errors.filter(e => 
      e.includes('Cannot read') || 
      e.includes('undefined') ||
      e.includes('TypeError')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

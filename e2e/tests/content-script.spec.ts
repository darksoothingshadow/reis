/**
 * E2E tests for content script injection on is.mendelu.cz
 */
import { test, expect } from '../fixtures/extension';
import { BrowserContext } from '@playwright/test';

test.describe('Content Script', () => {
  test('extension injects on is.mendelu.cz auth page', async ({ extensionContext }: { extensionContext: BrowserContext }) => {
    const page = await extensionContext.newPage();
    
    // Navigate to MENDELU auth page
    await page.goto('https://is.mendelu.cz/auth/', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Wait for potential injection
    await page.waitForTimeout(3000);

    // Check if extension injected anything
    // Look for reIS-specific elements or modifications
    const injectedElements = await page.evaluate(() => {
      // Check for injected iframe, shadow DOM, or specific classes
      const iframe = document.querySelector('iframe[src*="chrome-extension"]');
      const reisElements = document.querySelectorAll('[class*="reis"], [id*="reis"]');
      const shadowRoots = document.querySelectorAll('*');
      
      let hasShadowRoot = false;
      shadowRoots.forEach(el => {
        if (el.shadowRoot) hasShadowRoot = true;
      });
      
      return {
        hasIframe: !!iframe,
        reisElementCount: reisElements.length,
        hasShadowRoot
      };
    });

    // Extension should inject something (iframe or shadow DOM)
    const isInjected = 
      injectedElements.hasIframe || 
      injectedElements.reisElementCount > 0 ||
      injectedElements.hasShadowRoot;
    
    expect(isInjected).toBe(true);
    
    await page.close();
  });

  test('extension does not break page functionality', async ({ extensionContext }: { extensionContext: BrowserContext }) => {
    const page = await extensionContext.newPage();
    
    await page.goto('https://is.mendelu.cz/auth/', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Check for JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', (err: Error) => errors.push(err.message));
    
    await page.waitForTimeout(2000);
    
    // Filter out known non-critical errors
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('analytics')
    );
    
    expect(criticalErrors).toHaveLength(0);
    
    await page.close();
  });
});

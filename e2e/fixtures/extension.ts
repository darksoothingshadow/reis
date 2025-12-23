import { test as base, chromium, BrowserContext, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { calculateExtensionId } from '../utils/id';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to built extension
const EXTENSION_PATH = path.join(__dirname, '..', '..', 'dist');

// Temporary user data directory
const USER_DATA_DIR = path.join(__dirname, '..', '..', '.playwright-user-data');

export type ExtensionFixtures = {
  extensionContext: BrowserContext;
  extensionPage: Page;
  extensionId: string;
  /** Console errors captured during the test - attached BEFORE page load */
  consoleErrors: string[];
  /** Page errors (uncaught exceptions) captured during the test */
  pageErrors: string[];
};

export const test = base.extend<ExtensionFixtures>({
  // Browser context with extension loaded
  extensionContext: async ({}, use) => {
    // Verify extension exists
    if (!fs.existsSync(path.join(EXTENSION_PATH, 'manifest.json'))) {
      throw new Error(
        `Extension not found at ${EXTENSION_PATH}. Run "npm run build:quick" first.`
      );
    }

    // Launch browser with extension
    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false,
      args: [
        // '--headless=new', // Disable for Xvfb test
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    // Load saved auth state if available
    const storageStatePath = path.join(__dirname, '..', '..', 'storageState.json');
    if (fs.existsSync(storageStatePath)) {
      const storageState = JSON.parse(fs.readFileSync(storageStatePath, 'utf-8'));
      if (storageState.cookies && storageState.cookies.length > 0) {
        await context.addCookies(storageState.cookies);
      }
    }

    await use(context);
    await context.close();
  },
  // Extension ID
  extensionId: async ({}, use) => {
    const manifestPath = path.join(__dirname, '..', '..', 'public', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    
    if (!manifest.key) {
        throw new Error('Manifest does not contain a "key" field. Extension ID cannot be determined.');
    }

    const EXTENSION_ID = calculateExtensionId(manifest.key);
    await use(EXTENSION_ID);
  },

  // Shared error arrays - populated before page load
  consoleErrors: async ({}, use) => {
    const errors: string[] = [];
    await use(errors);
  },

  pageErrors: async ({}, use) => {
    const errors: string[] = [];
    await use(errors);
  },

  // Page for extension popup/UI - with console monitoring attached BEFORE navigation
  extensionPage: async ({ extensionContext, extensionId, consoleErrors, pageErrors }, use) => {
    const page = await extensionContext.newPage();
    
    // CRITICAL: Attach listeners BEFORE navigation to catch all errors
    // This is the Munger-style fix: monitor from the very start
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out favicon errors (common, harmless)
        if (!text.includes('favicon')) {
          consoleErrors.push(text);
        }
      }
    });
    
    // Catch uncaught exceptions (pageerror)
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
    
    // Mock the success rates API to return predictable test data
    await page.route('**/api/success-rates*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          courseCode: 'TEST-COURSE',
          stats: [{
            semesterName: 'LS 2024/2025',
            totalPass: 85,
            totalFail: 15,
            terms: [
              { term: 'termín 1', grades: { A: 20, B: 30, C: 20, D: 10, E: 5, F: 10, FN: 5 }, pass: 85, fail: 15 }
            ]
          }],
          lastUpdated: new Date().toISOString()
        })
      });
    });
    
    // Navigate to extension popup
    // Use a fixed URL for stability in CI/CD environment
    await page.goto(`chrome-extension://${extensionId}/index.html`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';

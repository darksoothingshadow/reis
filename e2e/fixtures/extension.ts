import { test as base, chromium, BrowserContext, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

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
  extensionId: async ({ extensionContext }, use) => {
    // ID derived from the key in manifest.json (feildjaginpppijbpplcghalabdeibdb)
    const EXTENSION_ID = 'feildjaginpppijbpplcghalabdeibdb';

    // Optional: Verify it matches service worker if running
    const workers = extensionContext.serviceWorkers();
    if (workers.length > 0) {
        const url = workers[0].url();
        const match = url.match(/chrome-extension:\/\/([^/]+)/);
        if (match && match[1] !== EXTENSION_ID) {
             console.warn(`⚠️ Mismatch: Calculated ID ${EXTENSION_ID} vs runtime ${match[1]}`);
        }
    }

    await use(EXTENSION_ID);
  },

  // Page for extension popup/UI
  extensionPage: async ({ extensionContext, extensionId }, use) => {
    const page = await extensionContext.newPage();
    
    // Navigate to extension popup
    await page.goto(`chrome-extension://${extensionId}/index.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';

import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: './e2e/tests',
  globalSetup: path.join(__dirname, 'e2e', 'global-setup.ts'),
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false, // Run tests sequentially for extension stability
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for extension testing
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    storageState: path.join(__dirname, 'storageState.json'),
  },
});

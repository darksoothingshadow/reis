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
    // Visual comparison settings
    toHaveScreenshot: {
      maxDiffPixels: 100,           // Allow minor anti-aliasing differences
      threshold: 0.2,               // Per-pixel color tolerance
      animations: 'disabled',       // Disable animations for consistency
    },
  },
  // Snapshot storage organization
  snapshotDir: './e2e/screenshots',
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',
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
  // Output directories for test artifacts
  outputDir: './e2e/test-results',
});


# E2E Testing with Playwright

This directory contains end-to-end tests for the REIS Chrome extension using Playwright.

## Quick Start

```bash
# 1. Install Playwright browsers (first time only)
npm run test:e2e:setup

# 2. Build the extension
npm run build:quick

# 3. Run E2E tests
npm run test:e2e
```

## Architecture

```
e2e/
├── fixtures/
│   └── extension.ts    # Playwright fixture that loads the Chrome extension
├── screenshots/         # Baseline screenshots for visual regression
├── tests/
│   ├── visual/                 # Visual regression tests
│   │   ├── calendar.spec.ts
│   │   ├── exams.spec.ts
│   │   └── search.spec.ts
│   ├── popup.spec.ts           # Popup UI tests
│   ├── exam-timeline.spec.ts   # Exam view tests
│   ├── search.spec.ts          # Search functionality
│   ├── file-drawer.spec.ts     # File drawer tests
│   ├── content-script.spec.ts  # Content script injection
│   └── visual-proof.spec.ts    # Legacy screenshot capture
└── global-setup.ts     # Authenticates with is.mendelu.cz before tests run
```

## Authentication

Tests authenticate with MENDELU using credentials from `.env`:

```env
MENDELU_USER=your_uco
MENDELU_PASS=your_password
```

The `global-setup.ts` script logs in once and saves the session to `storageState.json`, which is reused across all tests.

## Visual Regression Testing

Visual tests use `toHaveScreenshot()` for baseline comparison. Screenshots are stored in `e2e/screenshots/`.

### Modular Visual Tests

```
e2e/tests/visual/
├── calendar.spec.ts    # Calendar view states
├── exams.spec.ts       # Exam timeline states
└── search.spec.ts      # Search functionality states
```

### Running Visual Tests

```bash
# Run all visual tests (generates baselines on first run)
xvfb-run playwright test tests/visual/

# Update baselines after intentional UI changes
xvfb-run playwright test tests/visual/ --update-snapshots

# Run specific visual test
xvfb-run playwright test tests/visual/calendar.spec.ts
```

### Baseline Workflow

1. **First run**: Creates baseline screenshots in `e2e/screenshots/`
2. **Subsequent runs**: Compares current UI against baselines
3. **Failures**: Shows diff highlighting changed pixels
4. **Update baselines**: Use `--update-snapshots` after intentional changes

### Legacy Visual Proof

Quick screenshot capture (no comparison, ephemeral):

```bash
xvfb-run playwright test visual-proof.spec.ts
ls -l proof-*.png
```

## Extension Fixture

The `fixtures/extension.ts` provides:

| Fixture | Description |
|---------|-------------|
| `extensionContext` | Browser context with extension loaded |
| `extensionPage` | Page navigated to `chrome-extension://[id]/index.html` |
| `extensionId` | The extension's Chrome ID |

Usage:
```typescript
import { test, expect } from '../fixtures/extension';

test('my test', async ({ extensionPage }) => {
  await expect(extensionPage.locator('.calendar')).toBeVisible();
});
```

## Adding New Tests

1. Create a new `.spec.ts` file in `e2e/tests/`
2. Import from `../fixtures/extension` (not `@playwright/test`)
3. Use `extensionPage` to interact with the popup UI
4. Run with `npm run test:e2e`

## Headless Execution

Tests run headless via Xvfb on Linux. The extension requires a visible browser window, so we use:

```bash
xvfb-run playwright test
```

This is already configured in `package.json` scripts.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Extension not found" | Run `npm run build:quick` first |
| Tests timeout | Increase timeout in `playwright.config.ts` |
| Auth fails | Check `.env` credentials, delete `storageState.json` |
| Screenshots missing | Ensure `xvfb-run` is installed (`apt install xvfb`) |

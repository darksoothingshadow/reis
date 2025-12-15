---
description: Capture screenshots of the current extension UI (Calendar, Exams, Search)
---
1. Build the extension to ensure latest changes are reflected
// turbo
npm run build:quick

2. Run the visual proof E2E test to generate screenshots
// turbo
xvfb-run playwright test visual-proof.spec.ts --timeout=60000

3. List the generated screenshots
// turbo
ls -l proof-*.png

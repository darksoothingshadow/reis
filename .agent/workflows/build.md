---
description: Build the Chrome extension after making code changes
---

# Build Workflow

After making code changes to the extension, ALWAYS run the full build:

// turbo
1. Run the complete build command:
```bash
cd /root/reis && npm run build
```

2. Verify the dist folder contains all required files:
   - `dist/content.js` - Content script
   - `dist/background.js` - Service worker
   - `dist/index.html` - Main app entry
   - `dist/manifest.json` - Extension manifest
   - `dist/offscreen.js` - Offscreen document script

3. If any of these files are missing, the build failed and needs investigation.

## Important Notes

- The build command runs tests first, then builds app, content script, and background script
- A partial build (only `npm run build:app`) will NOT produce all required files
- Always wait for the full build to complete before telling the user to reload the extension

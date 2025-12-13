---
description: Build the Chrome extension after making code changes
---

# Build Workflow

After making code changes to the extension, run this build process:

// turbo
1. Run the complete build command:
```bash
cd /root/reis && npm run build
```

// turbo
2. Copy build output to the extension directory:
```bash
rm -rf ~/reis-dist && cp -r /root/reis/dist ~/reis-dist
```

// turbo
3. Verify all required files exist:
```bash
ls ~/reis-dist/content.js ~/reis-dist/background.js ~/reis-dist/index.html ~/reis-dist/manifest.json ~/reis-dist/offscreen.js 2>&1
```

## Required Files Checklist

These files MUST exist in `~/reis-dist/` for the extension to load:
- `content.js` - Content script (injected into pages)
- `background.js` - Service worker 
- `index.html` - Main app entry
- `manifest.json` - Extension manifest
- `offscreen.js` - Offscreen document script

## Troubleshooting

If the verification step shows "No such file or directory":
- The build failed or was incomplete
- Check the build output for errors
- Run `npm run build` again and wait for full completion

> **CRITICAL**: The extension is loaded from `~/reis-dist`, NOT `/root/reis/dist`. Always run step 2 to copy files!


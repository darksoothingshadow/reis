---
description: Automated structural hygiene check for component size and unused exports.
---

# Structural Hygiene Workflow

This workflow enforces the "250-Line Rule" and detects unused exports to prevent architectural rot.

## When to Run
1. Before merging any PR
2. After significant refactoring work
3. As part of CI/CD pipeline (if available)

## Steps

### 1. Check File Lengths
// turbo
```bash
find src -name "*.tsx" -o -name "*.ts" | xargs wc -l | sort -nr | head -20
```
Components over 250 lines require decomposition into:
- Custom hooks for logic
- Sub-components for UI

### 2. Run Lint Check
// turbo
```bash
npm run lint 2>&1 | grep -E "^✖|error" | head -20
```
All lint errors must be resolved.

### 3. Run Unit Tests
// turbo
```bash
npm run test:run
```
All tests must pass.

### 4. Verify Build
// turbo
```bash
npm run build:app
```
Build must succeed without TypeScript errors.

## Remediation
If any file exceeds 250 lines:
1. Extract logic into custom hooks (`useXxx.ts`)
2. Split UI into atomic sub-components
3. Move data/constants to dedicated files
4. Update original file to re-export for backward compatibility

## Notes
- The `xvfb` error for E2E tests is an environment issue, not a code issue
- Large chunk warnings (>500kB) are informational and can be addressed with code-splitting later

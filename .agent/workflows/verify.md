# Verification Workflow

This workflow provides a technical "Proof of Work" for your changes. Run it before submitting a PR or asking for Supervisor review.

## 1. Complete Build (Safe Mode)
// turbo
```bash
cd /root/reis && rm -rf dist && npm run build:quick
```

## 2. Technical Audit (E2E & Smoke)
// turbo
```bash
xvfb-run npm run test:smoke && xvfb-run playwright test
```

## 3. Visual Proofs
// turbo
```bash
xvfb-run playwright test visual-proof.spec.ts && ls -l proof-*.png
```

## 4. Deploy to Local Environment
// turbo
```bash
rm -rf ~/reis-dist && cp -r /root/reis/dist ~/reis-dist
```
> [!IMPORTANT]
> The extension is loaded by the system from `~/reis-dist`. This step ensures your changes are active.

## 5. Troubleshooting
- **Build Fail**: Check for TypeScript errors or missing dependencies.
- **E2E Fail**: Inspect `playwright-report/` for screenshots.
- **Missing Files**: Run `ls ~/reis-dist/manifest.json`.

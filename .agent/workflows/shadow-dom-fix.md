---
description: Fix CSS/styling issues in Shadow DOM (DaisyUI components not rendering)
---

# Shadow DOM CSS Troubleshooting

This project runs inside a **Shadow DOM** (Chrome extension content script). CSS frameworks like DaisyUI often break.

## Quick Diagnosis

1. **Check if CSS is in bundle**:
   ```bash
   grep -o '\.classname{' dist/content.js | head -5
   ```
   - If 0 matches → CSS not generated (JIT issue)
   - If matches exist → CSS exists but not applying (selector issue)

2. **Check component complexity**:
   - Simple (btn, card, badge) → Usually works
   - Complex (toggle, checkbox, dropdown) → Often breaks

## Known Broken Components

| DaisyUI Component | Status | Fix |
|-------------------|--------|-----|
| `toggle` | ❌ Broken | Use custom inline-styled toggle |
| `checkbox` | ❌ Likely broken | Use custom or Radix |
| `radio` | ❌ Likely broken | Use custom or Radix |
| `dropdown` | ⚠️ May break | Test first |
| `btn` | ✅ Works | - |
| `card` | ✅ Works | - |
| `badge` | ✅ Works | - |

## Fix Strategy

// turbo-all

### Step 1: Identify the broken component
Look at DevTools → Elements → Shadow DOM → check if element has classes but no visual styling.

### Step 2: Check if CSS exists
```bash
grep -o '\.toggle[^{]*{' dist/content.js | head -10
```

### Step 3: Replace with inline-styled version
Instead of:
```tsx
<input type="checkbox" className="toggle toggle-primary" />
```

Use:
```tsx
<button
  role="switch"
  aria-checked={enabled}
  onClick={toggle}
  className="relative inline-flex h-[22px] w-[42px] items-center rounded-full"
  style={{
    backgroundColor: enabled ? '#79be15' : '#d1d5db',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)'
  }}
>
  <span
    className="inline-block rounded-full bg-white"
    style={{
      width: '18px',
      height: '18px',
      transform: enabled ? 'translateX(22px)' : 'translateX(2px)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
    }}
  />
</button>
```

## Root Cause Reference

See: `.gemini/antigravity/brain/*/shadow-dom-analysis.md` for full architecture guide.

Key points:
- Shadow DOM isolates styles
- Tailwind JIT only scans source files, not runtime DOM
- Complex selectors (`:has()`, `:checked::before`) often fail
- Use headless libraries (Radix) + inline styles for interactive components

# Supervisor Protocol (The Orchestrator)

The Supervisor represents the high-level brain for PR reviews and major changes. Invoke this to coordinate the Trinity.

---

## Stage 1: Arch Auditor (@arch-guardian)
Run hygiene checks and architectural review:
// turbo
```bash
grep -rE "#[0-9a-fA-F]{3,6}" src/components --include="*.tsx" | head -5
grep -r "style={{" src/components --include="*.tsx" | wc -l
```
- [ ] No hardcoded hex colors
- [ ] Minimal inline styles
- [ ] `@arch-guardian review <files>` passed
- [ ] Message origin validation verified

---

## Stage 2: Safety Clearance (@safety-officer)
- [ ] Run `/pre-flight` before major changes
- [ ] `@safety-officer invert <implementation_plan>` performed
- [ ] No "Negative Constraints" violated (Delete Root, Exfiltrate Keys, etc.)

---

## Stage 3: Data Integrity (@seymour-cash)
- [ ] Run `/seymour-scrutiny` if parsers or scripts were changed
- [ ] Sanity bounds in `examParser.ts` (or similar) are confirmed
- [ ] Evidence artifacts (`debug-*.html`) inspected

---

## Stage 4: Technical Proof (@verify)
- [ ] Run `/verify`
- [ ] Build successful
- [ ] Smoke tests passed
- [ ] Visual proofs (`proof-*.png`) match expectations

---

## Verdict
- **LGTM**: If all stages green.
- **BLOCK**: If any auditor found a "Hallucination Breach" or security flaw.

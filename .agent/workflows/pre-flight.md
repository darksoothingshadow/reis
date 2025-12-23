# Pre-flight Workflow

This workflow MUST be run before starting any major refactor or dangerous operation. It ensures a stable starting state and a "Margin of Safety".

## 1. Environment Sanity Check
// turbo
```bash
git status --short
```
> [!IMPORTANT]
> If there are uncommitted changes, `@safety-officer` recommends committing or stashing them before proceeding.

## 2. Disk & Resource Check
// turbo
```bash
df -h . | awk 'NR==2 {print $4}'
```
> [!NOTE]
> Ensure at least 1GB of free space before running large builds or E2E tests.

## 3. Dependency Integrity
// turbo
```bash
ls -d node_modules > /dev/null 2>&1 || npm install
```

## 4. Safety Clearance
Instruct the `@safety-officer` to scan for potential risks in the current plan.
// turbo
```bash
@safety-officer scan-risk
```

## 5. Inversion Exercise
List 3 ways the upcoming task could fail and how to revert.
1. [ ] Failure Case 1: ... -> Revert: `git checkout .`
2. [ ] Failure Case 2: ... -> Revert: `npm install`
3. [ ] Failure Case 3: ... -> Revert: `rm -rf dist`

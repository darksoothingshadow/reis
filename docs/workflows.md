# REIS Agent Workflows

This document explains the agentic slash commands and standard operating procedures (SOPs) used in the REIS project.

## ⚡ Slash Commands

Our agents use specialized workflows to automate structural hygiene and data integrity.

### 1. `/structural-hygiene`
**Purpose**: Enforces the "250-Line Rule" and architectural consistency.
**Checks**:
- File size (ensures no file exceeds 250 lines).
- Unused exports detection.
- Linting and build verification.

**Usage**: Before any major merge or after significant refactoring.

### 2. `/seymour-scrutiny`
**Purpose**: Data integrity protocol for scraper updates.
**Actions**:
- Captures `debug-*.html` files from scrapped sessions.
- Compares parsed JSON output against raw HTML evidence.
- Verifies that all expected fields (Subject IDs, Times, Locations) are correct.

**Usage**: Whenever a parser or scraper logic is modified.

### 3. `/database-management`
**Purpose**: Manages the success rate database and global cache.
**Actions**:
- Runs the faculty crawler.
- Updates `success-rates-global.json`.
- Verifies database schema integrity.

## 🛠️ Trinity Protocol Enforcement

The project follows the "Trinity Protocol" (Munger-style constraints):

- **Inversion Strategy**: Before implementing a feature, the agent must list 3 ways it could fail.
- **Evidence-Based Action**: Scraper fixes MUST be backed by raw HTML artifacts.
- **Symmetry (Skin in the Game)**: Agents are responsible for the performance impacts of their code.

## 🧪 CI/CD Integration

These workflows are designed to be run by the AI agent but can be manually triggered or integrated into Github Actions in the future.

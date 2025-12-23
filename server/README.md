# reIS Server & Database

This directory contains the server-side components for reIS, primarily focused on providing supplemental data that isn't available via standard IS scraping or that requires aggregation.

## Success Rate System

The Success Rate system tracks subject difficulty across semesters using a SQLite-backed scraper.

### Architecture

- **Database**: `server/db/success-rates.db` (SQLite)
- **Schema**: `server/db/schema.sql` (Tables: `faculties`, `semesters`, `courses`, `success_rates`)
- **Scraper**: `scripts/crawl-success-rates.ts`
- **API**: `server/src/routes/success-rates.ts`

### Database Management

The database uses `better-sqlite3` for synchronous, high-performance operations.

#### Schema Overview

- `faculties`: Stores faculty metadata (id, name).
- `semesters`: Grouped by faculty, tracks when a semester was last crawled.
- `courses`: Unique subjects (code, name, predmetId).
- `success_rates`: The core data, linked to `courses` and `semesters`. Stores counts for grades A-FN.

### Success Rate Crawler

The crawler uses Playwright to navigate the IS MENDELU study statistics pages.

#### CLI Usage

```bash
# Run for all faculties (Full Crawl)
npx tsx scripts/crawl-success-rates.ts

# Resume interrupted crawl
npx tsx scripts/crawl-success-rates.ts --resume

# Limit to specific faculty
npx tsx scripts/crawl-success-rates.ts --faculty=PEF

# Developer test run (limit courses)
npx tsx scripts/crawl-success-rates.ts --faculty=AF --limit=5
```

#### Resume Logic
The crawler tracks `last_scraped` timestamps. When running with `--resume`, it checks if a course already has data in the current semester and skips it, allowing for efficient recovery from network failures or OOMs.

### Persistent Background Execution

Since the crawl can take several hours, you should run it in a way that survives your terminal session being closed.

#### Option 1: Simple (nohup)
The easiest way without installing new tools.
```bash
nohup npx tsx scripts/crawl-success-rates.ts --resume > crawler.log 2>&1 &
```
- `> crawler.log`: Saves output to a file.
- `2>&1`: Captures errors too.
- `&`: Runs in background.
- You can now safely close your computer.

#### Option 2: Professional (PM2)
Recommended for long-term management.
```bash
# Install PM2
npm install -g pm2

# Start crawler
pm2 start "npx tsx scripts/crawl-success-rates.ts --resume" --name "reis-crawler"

# Monitor
pm2 logs reis-crawler
pm2 status
```

### Checking Results

When you return, here is how to verify the crawl:

#### 1. Check if it's still running
```bash
# For nohup
ps aux | grep tsx

# For PM2
pm2 status
```

#### 2. View progress logs
```bash
# For nohup
tail -n 20 crawler.log

# For PM2
pm2 logs reis-crawler --lines 20
```

#### 3. Summary of data in DB
Run this one-liner to see how many courses were successfully scraped per faculty:
```bash
cd server && npx tsx -e "import { getDb, closeDb } from './db'; const db = getDb(); console.table(db.prepare('SELECT f.name, COUNT(DISTINCT sr.course_id) as courses FROM faculties f JOIN semesters s ON f.id = s.faculty_id JOIN success_rates sr ON s.id = sr.semester_id GROUP BY f.name').all()); closeDb();"
```

### Deployment

The server runs on port `3001` (default) and should be managed by `pm2` or similar in production.

```bash
cd server
npm run dev # Start with tsx
```

---
description: Workflow for managing the success rate database and crawler.
---

# Success Rate Database Management Workflow

This workflow describes how to maintain and update the Success Rate database.

## 1. Inspecting Database Status
Check how many courses are scraped per faculty.

```bash
cd server && npx tsx -e "import { getDb, closeDb } from './db'; const db = getDb(); console.log(db.prepare('SELECT f.name, COUNT(DISTINCT sr.course_id) as count FROM faculties f JOIN semesters s ON f.id = s.faculty_id JOIN success_rates sr ON s.id = sr.semester_id GROUP BY f.name').all()); closeDb();"
```

## 2. Resuming or Starting a Crawl
Always prefer resume mode if the script was interrupted.

### Persistent Run (Safe to close computer)
Use `nohup` to ensure the process continues on the server even if you disconnect.
```bash
nohup npx tsx scripts/crawl-success-rates.ts --resume > crawler.log 2>&1 &
```

Alternatively, use PM2:
```bash
pm2 start "npx tsx scripts/crawl-success-rates.ts --resume" --name "reis-crawler"
```

### Standard Run
```bash
# Resume manually
npx tsx scripts/crawl-success-rates.ts --resume
```

## 3. Checking Results
When you return, verify the progress:

### Check Status
```bash
# If using nohup
ps aux | grep tsx

# If using PM2
pm2 status
```

### Check Database Counts
```bash
cd server && npx tsx -e "import { getDb, closeDb } from './db'; const db = getDb(); console.table(db.prepare('SELECT f.name, COUNT(DISTINCT sr.course_id) as courses FROM faculties f JOIN semesters s ON f.id = s.faculty_id JOIN success_rates sr ON s.id = sr.semester_id GROUP BY f.name').all()); closeDb();"
```

## 4. Schema Changes
If you modify `server/db/schema.sql`:
1. Delete `server/db/success-rates.db` (Caution: data loss)
2. Run the crawler again to re-initialize and populate.

## 4. Troubleshooting
If the crawler finds 0 courses:
- Check `debug-semester-*.html` files created in the root.
- Verify table IDs (e.g., `table#tmtab_1`) in the scraper logic.

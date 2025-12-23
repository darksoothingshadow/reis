---
description: The Seymour Cash Scrutiny Protocol for Scraper Updates. Performed by @seymour-cash.
---
// turbo-all
1. Before modifying logic in `scripts/` or `src/api/`, run the current script with debug output enabled (e.g., `npx tsx scripts/crawl-success-rates.ts`).
2. Use `find_by_name` to locate the latest evidence artifacts (e.g., `debug-*.html`, `debug-*.png`).
3. Use `view_file` to inspect the HTML content. Verify the table identifiers (`id="tmtab_1"`) and row classes (`tr.uis-hl-table`) still exist.
4. Compare the captured HTML structure with the proposed regex/selector changes in the code.
5. After implementation, run the script and inspect the *newly* generated artifacts to ensure the "Success Rate" values extracted by the Boss match the visual representation in the PNG.
6. Verify the `stdout` logs for "❌ Error" or "hallucination" warnings.

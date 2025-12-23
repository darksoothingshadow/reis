#!/bin/bash
# Incremental Faculty Scraping Script
# Halts on any failure (scrape or test) to allow fixing issues before continuing.

set -e  # Exit immediately on any error

FACULTIES=(2 14 23 38 60 220 631 79)
FACULTY_NAMES=("PEF" "Agronomická" "FRRMS" "LDF" "Zahradnická" "ICV" "CSA" "Rektorát")

echo "🚀 Starting incremental faculty scraping (${#FACULTIES[@]} faculties)..."
echo "   Script will HALT on any failure."
echo ""

for i in "${!FACULTIES[@]}"; do
    FACULTY_ID=${FACULTIES[$i]}
    FACULTY_NAME=${FACULTY_NAMES[$i]}
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🏫 [$((i+1))/${#FACULTIES[@]}] Scraping: $FACULTY_NAME (ID: $FACULTY_ID)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Run production crawler for this faculty
    # We use --resume to skip already scraped courses in case of restart
    npx tsx scripts/crawl-success-rates.ts --faculty="$FACULTY_NAME" --resume
    
    echo ""
    echo "🧪 Testing data integrity for $FACULTY_NAME..."
    
    # Run integrity tests
    cd server && CHECK_FACULTY=$FACULTY_ID npx vitest run scripts/scraper.test.ts --reporter=verbose
    cd ..
    
    echo ""
    echo "✅ $FACULTY_NAME complete!"
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 All ${#FACULTIES[@]} faculties scraped and tested successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Run export:    cd server && npx tsx scripts/export-data.ts"
echo "  2. Push to GitHub: cd server/dist-data && git push"

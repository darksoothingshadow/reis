#!/bin/bash
# Success Rate Crawler - Deployment Script

# Configuration - Update these or pass as arguments
SERVER_IP=${1:-"your_server_ip"}
REMOTE_USER=${2:-"root"}
REMOTE_DIR="~/reis-crawler"

echo "🚀 Deploying Success Rate Crawler to ${REMOTE_USER}@${SERVER_IP}..."

# 1. Sync project files (excluding bulky directories)
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude '.playwright-user-data' \
  --exclude 'test-results' \
  --exclude 'playwright-report' \
  ./ ${REMOTE_USER}@${SERVER_IP}:${REMOTE_DIR}

# 2. Remote setup
ssh ${REMOTE_USER}@${SERVER_IP} << EOF
  echo "📦 Installing dependencies on server..."
  cd ${REMOTE_DIR}
  
  # Ensure Node.js is installed (assuming Ubuntu/Debian)
  if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi

  npm install
  
  echo "🌐 Installing Chromium for Playwright..."
  npx playwright install chromium --with-deps

  echo "📅 Setting up cron job (runs every 30 days)..."
  (crontab -l 2>/dev/null; echo "0 0 1 * * cd ${REMOTE_DIR} && npx tsx scripts/crawl-success-rates.ts >> crawler.log 2>&1") | crontab -

  echo "✅ Deployment complete!"
  echo "To run the first crawl manually: ssh ${REMOTE_USER}@${SERVER_IP} 'cd ${REMOTE_DIR} && npx tsx scripts/crawl-success-rates.ts'"
EOF

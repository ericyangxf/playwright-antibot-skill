#!/bin/bash
# Ensure Playwright dependencies are installed
# Run this before executing any scraping code

# Get the directory where this script is located
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SKILL_DIR" || exit 1

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install

    echo "🌐 Installing Chromium browser..."
    npx playwright install chromium

    echo "✅ Setup complete!"
else
    echo "✅ Dependencies already installed"
fi

# Verify playwright is accessible
if node -e "require('playwright'); console.log('✓ Playwright is ready')" 2>/dev/null; then
    exit 0
else
    echo "❌ Error: Playwright not found. Run 'npm install' in the skill directory"
    exit 1
fi

#!/bin/bash

echo "📊 MarketMind File Audit Report"
echo "================================"
echo ""
echo "Generated: $(date)"
echo ""

echo "## File Counts by Workspace"
echo ""
echo "### apps/electron"
find apps/electron/src -type f -name "*.ts" -o -name "*.tsx" | wc -l | xargs echo "TypeScript files:"
find apps/electron/src -type f -name "*.test.ts" -o -name "*.test.tsx" | wc -l | xargs echo "Test files:"
echo ""

echo "### apps/backend"
find apps/backend/src -type f -name "*.ts" | wc -l | xargs echo "TypeScript files:"
find apps/backend/src -type f -name "*.test.ts" | wc -l | xargs echo "Test files:"
echo ""

echo "### packages/types"
find packages/types/src -type f -name "*.ts" 2>/dev/null | wc -l | xargs echo "TypeScript files:"
echo ""

echo "### packages/indicators"
find packages/indicators/src -type f -name "*.ts" 2>/dev/null | wc -l | xargs echo "TypeScript files:"
echo ""

echo "## File Sizes"
echo ""
echo "### Largest Files"
find apps packages -type f \( -name "*.ts" -o -name "*.tsx" \) -exec wc -l {} + | sort -rn | head -20
echo ""

echo "## Documentation"
echo ""
echo "Total docs:"
find docs -type f -name "*.md" | wc -l
echo ""
echo "Docs by category:"
echo "TRADING: $(find docs -type f -name "TRADING*.md" | wc -l)"
echo "BACKTESTING: $(find docs -type f -name "BACKTESTING*.md" | wc -l)"
echo "CONTEXT: $(find docs -type f -name "*CONTEXT*.md" | wc -l)"
echo "STATUS: $(find docs -type f -name "*STATUS*.md" -o -name "*COMPLETE*.md" | wc -l)"
echo ""

echo "## Component Files"
echo ""
find apps/electron/src/renderer/components -type f -name "*.tsx" | wc -l | xargs echo "React components:"
echo ""

echo "## Done ✅"

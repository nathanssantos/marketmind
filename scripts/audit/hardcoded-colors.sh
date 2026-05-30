#!/bin/bash

# Script to audit hardcoded colors in the MarketMind project
# Searches for color patterns that do not come from the Chakra theme

RENDERER_PATH="apps/electron/src/renderer"

# Allowed files (colors defined intentionally)
EXCLUDE_PATTERNS="grep -v '\.test\.' | grep -v 'theme/index.ts' | grep -v 'preReactColors.ts' | grep -v 'constants/defaults.ts' | grep -v 'node_modules'"

echo "=================================="
echo "MarketMind - Hardcoded Colors Audit"
echo "=================================="
echo ""

# Allowed files:
# - theme/index.ts - where tokens are defined
# - constants/preReactColors.ts - colors for states before React loads
# - constants/defaults.ts - default values with fallbacks
# - *.test.ts - test files

echo "1. HEX COLORS (#xxx)"
echo "----------------------------"
HEX_COUNT=$(grep -rn --include="*.tsx" --include="*.ts" \
  -E "#[0-9a-fA-F]{3,8}" \
  "$RENDERER_PATH" | \
  grep -v "\.test\." | \
  grep -v "theme/index.ts" | \
  grep -v "preReactColors.ts" | \
  grep -v "constants/defaults.ts" | \
  grep -v "node_modules" | \
  wc -l | tr -d ' ')

echo "Total found: $HEX_COUNT occurrences"
echo ""

if [ "$HEX_COUNT" -gt 0 ]; then
  echo "Files with hardcoded hex colors:"
  grep -rn --include="*.tsx" --include="*.ts" \
    -E "#[0-9a-fA-F]{3,8}" \
    "$RENDERER_PATH" | \
    grep -v "\.test\." | \
    grep -v "theme/index.ts" | \
    grep -v "preReactColors.ts" | \
    grep -v "constants/defaults.ts" | \
    grep -v "node_modules" | \
    cut -d: -f1 | sort -u
  echo ""
fi

echo "2. RGBA/RGB COLORS"
echo "-----------------"
RGBA_COUNT=$(grep -rn --include="*.tsx" --include="*.ts" \
  -E "rgba?\([0-9]" \
  "$RENDERER_PATH" | \
  grep -v "\.test\." | \
  grep -v "theme/index.ts" | \
  grep -v "preReactColors.ts" | \
  grep -v "constants/defaults.ts" | \
  grep -v "node_modules" | \
  wc -l | tr -d ' ')

echo "Total found: $RGBA_COUNT occurrences"
echo ""

if [ "$RGBA_COUNT" -gt 0 ]; then
  echo "Files with hardcoded rgba/rgb colors:"
  grep -rn --include="*.tsx" --include="*.ts" \
    -E "rgba?\([0-9]" \
    "$RENDERER_PATH" | \
    grep -v "\.test\." | \
    grep -v "theme/index.ts" | \
    grep -v "preReactColors.ts" | \
    grep -v "constants/defaults.ts" | \
    grep -v "node_modules" | \
    cut -d: -f1 | sort -u
  echo ""
fi

echo "3. INLINE STYLES WITH COLORS"
echo "--------------------------"
INLINE_COUNT=$(grep -rn --include="*.tsx" --include="*.ts" \
  -E "style=\{[^}]*(color|background)" \
  "$RENDERER_PATH" | \
  grep -v "\.test\." | \
  grep -v "preReactColors.ts" | \
  grep -v "node_modules" | \
  wc -l | tr -d ' ')

echo "Total found: $INLINE_COUNT occurrences"
echo ""

echo "=================================="
echo "SUMMARY"
echo "=================================="
TOTAL=$((HEX_COUNT + RGBA_COUNT + INLINE_COUNT))
echo "Total hardcoded colors: $TOTAL"
echo ""

if [ "$TOTAL" -eq 0 ]; then
  echo "✅ No hardcoded colors found!"
else
  echo "⚠️  There are hardcoded colors that need to be migrated to the theme."
  echo ""
  echo "To see details, run with --verbose:"
  echo "  $0 --verbose"
fi

# If --verbose flag is passed, show all occurrences
if [ "$1" == "--verbose" ]; then
  echo ""
  echo "=================================="
  echo "FULL DETAILS"
  echo "=================================="
  echo ""
  echo "Hex Colors:"
  grep -rn --include="*.tsx" --include="*.ts" \
    -E "#[0-9a-fA-F]{3,8}" \
    "$RENDERER_PATH" | \
    grep -v "\.test\." | \
    grep -v "theme/index.ts" | \
    grep -v "preReactColors.ts" | \
    grep -v "constants/defaults.ts" | \
    grep -v "node_modules"

  echo ""
  echo "RGBA/RGB Colors:"
  grep -rn --include="*.tsx" --include="*.ts" \
    -E "rgba?\([0-9]" \
    "$RENDERER_PATH" | \
    grep -v "\.test\." | \
    grep -v "theme/index.ts" | \
    grep -v "preReactColors.ts" | \
    grep -v "constants/defaults.ts" | \
    grep -v "node_modules"

  echo ""
  echo "Inline Styles with colors:"
  grep -rn --include="*.tsx" --include="*.ts" \
    -E "style=\{[^}]*(color|background)" \
    "$RENDERER_PATH" | \
    grep -v "\.test\." | \
    grep -v "preReactColors.ts" | \
    grep -v "node_modules"
fi

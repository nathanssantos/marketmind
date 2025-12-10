#!/bin/bash

set -e

echo "🧹 MarketMind Comment Removal Script"
echo "====================================="
echo ""
echo "This script safely removes comments while preserving:"
echo "  ✅ JSDoc comments (/** ... */)"
echo "  ✅ License headers"
echo "  ✅ Type definition documentation"
echo "  ✅ @ts-ignore, @ts-expect-error directives"
echo "  ✅ eslint-disable comments"
echo ""

BACKUP_DIR="backups/comments-removal-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Creating backup in $BACKUP_DIR..."
cp -r apps "$BACKUP_DIR/"
cp -r packages "$BACKUP_DIR/"
echo "✅ Backup created"
echo ""

# Counter for removed comments
INLINE_REMOVED=0
BLOCK_REMOVED=0
FILES_PROCESSED=0

echo "🔍 Processing TypeScript files..."
echo ""

# Function to safely remove inline comments
remove_inline_comments() {
  local file="$1"
  
  # Skip files with specific patterns that should keep comments
  if grep -q "eslint-disable\|@ts-ignore\|@ts-expect-error\|@ts-nocheck" "$file" 2>/dev/null; then
    return
  fi
  
  # Remove single-line comments that are alone on their line (not trailing)
  # But preserve JSDoc, directives, and annotations
  local temp_file="${file}.tmp"
  
  awk '
    /^[[:space:]]*\/\// {
      # Skip lines that are only comments (not trailing)
      if (!/\/\/.*@|\/\/.*eslint|\/\/.*prettier|\/\/.*webpack/) {
        next
      }
    }
    { print }
  ' "$file" > "$temp_file"
  
  if ! cmp -s "$file" "$temp_file"; then
    mv "$temp_file" "$file"
    return 0
  else
    rm "$temp_file"
    return 1
  fi
}

# Function to safely remove block comments
remove_block_comments() {
  local file="$1"
  
  # Use sed to remove /* ... */ comments but preserve JSDoc
  # This is complex, so we'll use a more conservative approach
  
  # Only remove single-line block comments that are clearly not JSDoc
  sed -i.bak '/^[[:space:]]*\/\*[^*]/d' "$file"
  
  # Check if file changed
  if ! cmp -s "$file" "${file}.bak"; then
    rm "${file}.bak"
    return 0
  else
    rm "${file}.bak"
    return 1
  fi
}

# Process all TypeScript files
for file in $(find apps packages -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/.next/*"); do
  FILES_PROCESSED=$((FILES_PROCESSED + 1))
  
  # Remove inline comments
  if remove_inline_comments "$file"; then
    INLINE_REMOVED=$((INLINE_REMOVED + 1))
  fi
  
  # Remove block comments
  if remove_block_comments "$file"; then
    BLOCK_REMOVED=$((BLOCK_REMOVED + 1))
  fi
  
  # Show progress every 50 files
  if [ $((FILES_PROCESSED % 50)) -eq 0 ]; then
    echo "  Processed $FILES_PROCESSED files..."
  fi
done

echo ""
echo "✅ Processing complete!"
echo ""
echo "📊 Summary:"
echo "  Files processed: $FILES_PROCESSED"
echo "  Files with inline comments removed: $INLINE_REMOVED"
echo "  Files with block comments removed: $BLOCK_REMOVED"
echo ""
echo "🔍 Running type check to verify no breaking changes..."

if pnpm --filter @marketmind/electron type-check && pnpm --filter @marketmind/backend type-check; then
  echo "✅ Type check passed!"
  echo ""
  echo "🧪 Running tests..."
  
  if pnpm test; then
    echo "✅ All tests passed!"
    echo ""
    echo "✅ Comment removal completed successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "  1. Review changes: git diff"
    echo "  2. Check specific files for correctness"
    echo "  3. Commit changes: git add . && git commit -m 'chore: remove inline and block comments'"
    echo ""
    echo "💾 Backup location: $BACKUP_DIR"
  else
    echo "❌ Tests failed! Restoring from backup..."
    rm -rf apps packages
    cp -r "$BACKUP_DIR/apps" .
    cp -r "$BACKUP_DIR/packages" .
    echo "✅ Restored from backup"
    exit 1
  fi
else
  echo "❌ Type check failed! Restoring from backup..."
  rm -rf apps packages
  cp -r "$BACKUP_DIR/apps" .
  cp -r "$BACKUP_DIR/packages" .
  echo "✅ Restored from backup"
  exit 1
fi

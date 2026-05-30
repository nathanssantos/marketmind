#!/bin/bash

# ============================================================================
# Script to install protection Git Hooks
# ============================================================================

set -e

echo "🔧 Installing protection Git Hooks..."
echo ""

# Create hooks directory if it does not exist
mkdir -p .git/hooks

# Copy pre-push hook
if [ -f ".git/hooks/pre-push" ]; then
    echo "✅ pre-push hook already installed"
    exit 0
fi

cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash

# Git Hook: pre-push
# Prevents direct pushes to the main branch
# Installation: This file must be at .git/hooks/pre-push

protected_branch='main'
current_branch=$(git symbolic-ref HEAD | sed -e 's,.*/\(.*\),\1,')

if [ "$current_branch" = "$protected_branch" ]; then
    echo ""
    echo "🚫 ================================================================================================"
    echo "🚫  PUSH BLOCKED!"
    echo "🚫 ================================================================================================"
    echo ""
    echo "   You are trying to push directly to the '$protected_branch' branch."
    echo ""
    echo "   The 'main' branch is protected and can only receive changes via Pull Request."
    echo ""
    echo "   ✅ Correct workflow:"
    echo "      1. Work on a feature branch: git checkout -b feature/my-feature"
    echo "      2. Push the feature: git push -u origin feature/my-feature"
    echo "      3. Create a PR: gh pr create --base develop"
    echo "      4. Merge via PR: gh pr merge <number>"
    echo ""
    echo "   💡 If you REALLY need to push directly (not recommended):"
    echo "      git push --no-verify"
    echo ""
    echo "🚫 ================================================================================================"
    echo ""
    exit 1
fi

exit 0
EOF

chmod +x .git/hooks/pre-push

echo "✅ pre-push hook installed successfully!"
echo ""
echo "🔒 The 'main' branch is now protected against direct pushes."
echo ""
echo "To test:"
echo "  git checkout main"
echo "  git push  # Should be blocked"
echo ""

#!/bin/bash

# ============================================================================
# Script to install protection + quality Git Hooks
# ============================================================================
# Installs two LLM-agnostic, deterministic hooks for every contributor:
#   - pre-commit : fast quality gate (lint + type-check) on the packages that
#                  have staged changes. Heavy work (full test suite, needs
#                  Docker) stays on CI / pre-push.
#   - pre-push   : blocks direct pushes to the protected 'main' branch.
# Both are rewritten on every run so the repo stays the single source of truth.

set -e

echo "🔧 Installing MarketMind Git Hooks..."
echo ""

mkdir -p .git/hooks

# ----------------------------------------------------------------------------
# pre-commit: fast quality gate scoped to staged packages
# ----------------------------------------------------------------------------
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# Git Hook: pre-commit
# Fast, deterministic quality gate: type-check + lint only for the packages
# touched by the staged changes. Bypass (not recommended): git commit --no-verify

set -euo pipefail

staged=$(git diff --cached --name-only --diff-filter=ACMR)
[ -z "$staged" ] && exit 0

touched_electron=false
touched_backend=false
touched_packages=false

while IFS= read -r file; do
    case "$file" in
        apps/electron/*) touched_electron=true ;;
        apps/backend/*)  touched_backend=true ;;
        packages/*)      touched_packages=true ;;
    esac
done <<< "$staged"

# Shared packages feed both apps — type-check both to catch cross-package breakage.
if [ "$touched_packages" = true ]; then
    touched_electron=true
    touched_backend=true
fi

if [ "$touched_electron" = false ] && [ "$touched_backend" = false ]; then
    exit 0
fi

run() {
    echo "▶ $*"
    if ! "$@"; then
        echo ""
        echo "🚫 pre-commit failed: $*"
        echo "   Fix the errors above, or bypass with: git commit --no-verify"
        exit 1
    fi
}

echo "🔍 pre-commit quality gate (staged packages)..."

if [ "$touched_electron" = true ]; then
    run pnpm --filter @marketmind/electron type-check
    run pnpm --filter @marketmind/electron lint
fi

if [ "$touched_backend" = true ]; then
    run pnpm --filter @marketmind/backend type-check
fi

echo "✅ pre-commit checks passed."
EOF

chmod +x .git/hooks/pre-commit
echo "✅ pre-commit hook installed (type-check + lint on staged packages)."

# ----------------------------------------------------------------------------
# pre-push: protect the 'main' branch from direct pushes
# ----------------------------------------------------------------------------
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash

# Git Hook: pre-push
# Prevents direct pushes to the main branch

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
echo "✅ pre-push hook installed (protects the 'main' branch)."

echo ""
echo "🔒 Hooks active. Bypass a single run with --no-verify if ever needed."
echo ""

#!/bin/bash

# ============================================================================
# Script para instalar Git Hooks de proteção
# ============================================================================

set -e

echo "🔧 Instalando Git Hooks de proteção..."
echo ""

# Criar diretório de hooks se não existir
mkdir -p .git/hooks

# Copiar pre-push hook
if [ -f ".git/hooks/pre-push" ]; then
    echo "⚠️  Hook pre-push já existe"
    read -p "Sobrescrever? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Instalação cancelada"
        exit 1
    fi
fi

cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash

# Git Hook: pre-push
# Previne push direto para branch main
# Instalação: Este arquivo deve estar em .git/hooks/pre-push

protected_branch='main'
current_branch=$(git symbolic-ref HEAD | sed -e 's,.*/\(.*\),\1,')

if [ "$current_branch" = "$protected_branch" ]; then
    echo ""
    echo "🚫 ================================================================================================"
    echo "🚫  PUSH BLOQUEADO!"
    echo "🚫 ================================================================================================"
    echo ""
    echo "   Você está tentando fazer push diretamente para a branch '$protected_branch'."
    echo ""
    echo "   A branch 'main' está protegida e só pode receber mudanças via Pull Request."
    echo ""
    echo "   ✅ Fluxo correto:"
    echo "      1. Trabalhe em uma feature branch: git checkout -b feature/minha-feature"
    echo "      2. Faça push da feature: git push -u origin feature/minha-feature"
    echo "      3. Crie um PR: gh pr create --base develop"
    echo "      4. Faça merge via PR: gh pr merge <numero>"
    echo ""
    echo "   💡 Se você REALMENTE precisa fazer push direto (não recomendado):"
    echo "      git push --no-verify"
    echo ""
    echo "🚫 ================================================================================================"
    echo ""
    exit 1
fi

exit 0
EOF

chmod +x .git/hooks/pre-push

echo "✅ Hook pre-push instalado com sucesso!"
echo ""
echo "🔒 A branch 'main' agora está protegida contra pushes diretos."
echo ""
echo "Para testar:"
echo "  git checkout main"
echo "  git push  # Deve ser bloqueado"
echo ""

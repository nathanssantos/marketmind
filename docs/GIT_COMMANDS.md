# 📝 Comandos Git & GitHub - Guia Rápido

## 🚀 Setup Inicial do Repositório

### Opção 1: Script Automatizado (Recomendado)
```bash
./scripts/setup-github.sh
```

### Opção 2: Comandos Manuais

#### 1. Criar repositório no GitHub
```bash
# Repositório público
gh repo create marketmind \
  --public \
  --description "Consultor de IA para análise técnica de gráficos financeiros" \
  --source=. \
  --remote=origin \
  --push

# OU repositório privado
gh repo create marketmind \
  --private \
  --description "Consultor de IA para análise técnica de gráficos financeiros" \
  --source=. \
  --remote=origin \
  --push
```

#### 2. Criar branch develop
```bash
git checkout -b develop
git push -u origin develop
```

#### 3. Definir develop como branch padrão (opcional)
```bash
gh repo edit --default-branch develop
```

#### 4. Adicionar tópicos
```bash
gh repo edit --add-topic electron
gh repo edit --add-topic react
gh repo edit --add-topic typescript
gh repo edit --add-topic trading
gh repo edit --add-topic ai
gh repo edit --add-topic candlestick-chart
gh repo edit --add-topic technical-analysis
gh repo edit --add-topic cryptocurrency
gh repo edit --add-topic stock-market
```

---

## 🔄 Workflow Diário

### Começar nova feature
```bash
# 1. Atualizar develop
git checkout develop
git pull origin develop

# 2. Criar branch da feature
git checkout -b feature/chart-rendering

# 3. Fazer mudanças...
# (código)

# 4. Commit
git add .
git commit -m "feat: adiciona renderização de candlestick"

# 5. Push
git push -u origin feature/chart-rendering

# 6. Criar Pull Request
gh pr create \
  --base develop \
  --title "Adiciona renderização de candlestick" \
  --body "Implementa renderização de gráficos candlestick com Canvas API"
```

### Revisar Pull Request
```bash
# Listar PRs abertas
gh pr list

# Ver detalhes de uma PR
gh pr view 1

# Fazer checkout da PR para testar
gh pr checkout 1

# Adicionar review
gh pr review 1 --approve
gh pr review 1 --comment --body "Ótimo trabalho!"
gh pr review 1 --request-changes --body "Precisa de ajustes"

# Fazer merge da PR
gh pr merge 1 --merge  # merge commit
gh pr merge 1 --squash # squash commits
gh pr merge 1 --rebase # rebase
```

### Commits frequentes
```bash
# Adicionar arquivos específicos
git add src/renderer/components/Chart/ChartCanvas.tsx

# Adicionar todos
git add .

# Commit com mensagem
git commit -m "feat: adiciona zoom no gráfico"

# Amend (corrigir último commit)
git commit --amend -m "feat: adiciona zoom e pan no gráfico"

# Push
git push

# Force push (cuidado! use apenas em branches próprias)
git push --force-with-lease
```

---

## 📦 Releases

### Criar Release
```bash
# 1. Atualizar main com develop
git checkout main
git pull origin main
git merge develop
git push origin main

# 2. Criar tag
git tag -a v1.0.0 -m "Release v1.0.0 - Initial Release"
git push origin v1.0.0

# 3. Build dos instaladores
npm run build:all

# 4. Criar release no GitHub
gh release create v1.0.0 \
  --title "v1.0.0 - Initial Release" \
  --notes "
## 🎉 First Release

### Features
- ✅ Renderização de gráficos candlestick
- ✅ Integração com AI
- ✅ Chat interativo
- ✅ Auto-update

### Download
- macOS: marketmind-1.0.0.dmg
- Windows: marketmind-1.0.0.exe
" \
  dist-electron/*.dmg \
  dist-electron/*.exe \
  dist-electron/latest-mac.yml \
  dist-electron/latest.yml
```

### Release Pre-release (beta)
```bash
gh release create v1.0.0-beta.1 \
  --title "v1.0.0-beta.1" \
  --notes "Beta release para testes" \
  --prerelease \
  dist-electron/*.dmg \
  dist-electron/*.exe
```

### Listar releases
```bash
gh release list
```

### Deletar release
```bash
gh release delete v1.0.0 --yes
git push --delete origin v1.0.0  # deletar tag também
```

---

## 🌿 Gerenciamento de Branches

### Criar branch
```bash
git checkout -b feature/ai-integration
git push -u origin feature/ai-integration
```

### Mudar de branch
```bash
git checkout develop
git checkout main
git checkout feature/chart-rendering
```

### Listar branches
```bash
# Locais
git branch

# Remotas
git branch -r

# Todas
git branch -a
```

### Deletar branch
```bash
# Local
git branch -d feature/old-feature

# Remota
git push origin --delete feature/old-feature
```

### Atualizar branch com develop
```bash
# Opção 1: Merge
git checkout feature/minha-feature
git merge develop

# Opção 2: Rebase (mantém histórico linear)
git checkout feature/minha-feature
git rebase develop
```

---

## 🔍 Visualização e Histórico

### Ver status
```bash
git status
git status -s  # formato curto
```

### Ver diferenças
```bash
# Mudanças não staged
git diff

# Mudanças staged
git diff --staged

# Diferença entre branches
git diff main develop

# Diferença de arquivo específico
git diff src/main/index.ts
```

### Ver histórico
```bash
# Log completo
git log

# Log resumido
git log --oneline

# Log com gráfico
git log --oneline --graph --all

# Log de um arquivo
git log -- src/main/index.ts

# Log com filtro
git log --author="Nathan"
git log --since="2025-01-01"
git log --grep="feat"
```

### Ver autores
```bash
git shortlog -s -n
```

---

## 🔧 Desfazer Mudanças

### Descartar mudanças locais
```bash
# Arquivo específico
git checkout -- src/main/index.ts

# Todos os arquivos
git checkout -- .

# Remover arquivos não rastreados
git clean -fd
```

### Desfazer commit (mantendo mudanças)
```bash
git reset --soft HEAD~1
```

### Desfazer commit (descartando mudanças)
```bash
git reset --hard HEAD~1
```

### Reverter commit (cria novo commit)
```bash
git revert HEAD
git revert abc123  # reverter commit específico
```

### Desfazer push (CUIDADO!)
```bash
# Apenas se ninguém mais deu pull
git reset --hard HEAD~1
git push --force-with-lease
```

---

## 🏷️ Tags

### Criar tag
```bash
# Tag anotada (recomendado)
git tag -a v1.0.0 -m "Version 1.0.0"

# Tag simples
git tag v1.0.0

# Tag em commit específico
git tag -a v1.0.0 abc123 -m "Version 1.0.0"
```

### Listar tags
```bash
git tag
git tag -l "v1.*"  # filtrar
```

### Push de tags
```bash
# Tag específica
git push origin v1.0.0

# Todas as tags
git push origin --tags
```

### Deletar tag
```bash
# Local
git tag -d v1.0.0

# Remota
git push origin --delete v1.0.0
```

---

## 🔄 Sincronização

### Atualizar repositório local
```bash
# Fetch (buscar mudanças sem merge)
git fetch origin

# Pull (fetch + merge)
git pull origin develop

# Pull com rebase
git pull --rebase origin develop
```

### Push
```bash
# Push da branch atual
git push

# Push com upstream
git push -u origin feature/nova-feature

# Push de todas as branches
git push --all

# Push forçado (CUIDADO!)
git push --force-with-lease
```

---

## 🐛 Issues

### Criar issue
```bash
gh issue create \
  --title "Bug: Gráfico não renderiza em dark mode" \
  --body "Descrição do problema..." \
  --label "bug" \
  --assignee "@me"
```

### Listar issues
```bash
# Todas abertas
gh issue list

# Filtrar por label
gh issue list --label "bug"

# Filtrar por assignee
gh issue list --assignee "@me"

# Incluir fechadas
gh issue list --state all
```

### Ver issue
```bash
gh issue view 1
gh issue view 1 --web  # abrir no browser
```

### Fechar issue
```bash
gh issue close 1 --comment "Corrigido na v1.0.1"
```

### Reabrir issue
```bash
gh issue reopen 1
```

---

## 👥 Colaboração

### Clonar repositório
```bash
gh repo clone USUARIO/marketmind
# ou
git clone https://github.com/USUARIO/marketmind.git
```

### Fork
```bash
gh repo fork USUARIO/marketmind --clone
```

### Adicionar colaborador
```bash
gh repo edit --enable-issues
gh repo edit --enable-wiki
```

### Ver colaboradores
```bash
gh api repos/:owner/:repo/contributors
```

---

## 📊 Estatísticas

### Ver contribuições
```bash
# Por arquivo
git log --pretty=format: --name-only | sort | uniq -c | sort -rg | head -10

# Por autor
git shortlog -s -n

# Linhas adicionadas/removidas
git log --shortstat --author="Nathan"
```

### Ver tamanho do repositório
```bash
git count-objects -vH
```

---

## 🔐 Configuração

### Configurar usuário
```bash
# Global
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"

# Local (apenas neste repo)
git config user.name "Seu Nome"
git config user.email "seu@email.com"
```

### Configurar editor
```bash
git config --global core.editor "code --wait"
```

### Configurar aliases
```bash
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.unstage 'reset HEAD --'
git config --global alias.last 'log -1 HEAD'
git config --global alias.lg "log --oneline --graph --all"
```

### Ver configurações
```bash
git config --list
git config --global --list
```

---

## 🚨 Troubleshooting

### Conflitos de merge
```bash
# Ver arquivos em conflito
git status

# Após resolver conflitos
git add .
git commit -m "merge: resolve conflitos"

# Abortar merge
git merge --abort
```

### Recuperar arquivo deletado
```bash
git checkout HEAD -- arquivo.txt
```

### Recuperar commit deletado
```bash
# Ver histórico completo (incluindo commits deletados)
git reflog

# Recuperar
git checkout abc123
```

### Limpar cache do Git
```bash
git rm -r --cached .
git add .
git commit -m "chore: limpa cache do git"
```

---

## 📚 Recursos Úteis

### Documentação
- [Git Docs](https://git-scm.com/doc)
- [GitHub CLI Docs](https://cli.github.com/manual/)
- [Conventional Commits](https://www.conventionalcommits.org/)

### Ferramentas
- **GitHub Desktop** - GUI para Git
- **GitKraken** - Cliente Git visual
- **SourceTree** - Gerenciador Git gratuito

### Extensões VS Code
- GitLens
- Git Graph
- GitHub Pull Requests

---

**Dica:** Adicione estes aliases ao seu `.zshrc` ou `.bashrc`:

```bash
# Git aliases
alias gs='git status'
alias ga='git add .'
alias gc='git commit -m'
alias gp='git push'
alias gl='git pull'
alias gco='git checkout'
alias gb='git branch'
alias gm='git merge'
alias glg='git log --oneline --graph --all'

# GitHub CLI aliases
alias ghv='gh repo view --web'
alias ghpr='gh pr create'
alias ghprl='gh pr list'
alias ghil='gh issue list'
```

Recarregue o terminal: `source ~/.zshrc`

---

Voltar para [README principal](../README.md) | [Scripts](./README.md)

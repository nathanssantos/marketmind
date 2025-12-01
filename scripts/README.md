# 🚀 Scripts do MarketMind

Scripts úteis para gerenciamento do repositório e desenvolvimento.

## ⚡ Setup Rápido (RECOMENDADO)

```bash
./scripts/setup.sh
```

**Setup automático completo que:**
- ✅ Verifica Node.js 20+ e pnpm 9+
- ✅ Instala dependências do monorepo
- ✅ Cria arquivos .env (frontend + backend)
- ✅ Gera keys de segurança automaticamente
- ✅ Configura PostgreSQL (se disponível)
- ✅ Executa migrations do banco
- ✅ Compila packages compartilhados
- ✅ Roda testes para validar setup
- ✅ Mostra checklist e próximos passos

**Após executar:**
1. Configure pelo menos 1 API key de IA em `.env`
2. Inicie backend: `pnpm --filter @marketmind/backend dev`
3. Inicie frontend: `pnpm --filter @marketmind/electron dev`

📚 Documentação completa: [docs/SETUP_GUIDE.md](../docs/SETUP_GUIDE.md)

---

## 📜 Scripts Disponíveis

### `setup.sh` ⭐

Script de setup automático completo do projeto.

### `clear-storage.mjs`

Script para limpar completamente o storage do Electron (dados persistidos).

**O que faz:**
- ✅ Deleta `config.json` (electron-store)
- ✅ Remove todos os dados salvos (API keys, conversas, trading data)
- ✅ Lista arquivos no diretório de storage
- ✅ Funciona em macOS, Windows e Linux

**Uso:**

```bash
npm run clear-storage
# ou
node scripts/clear-storage.mjs
```

**⚠️ ATENÇÃO:** Isso remove TODOS os dados salvos. Use com cuidado!

**Caminhos de storage por plataforma:**
- macOS: `~/Library/Application Support/MarketMind/config.json`
- Windows: `%APPDATA%\MarketMind\config.json`
- Linux: `~/.config/MarketMind/config.json`

### `setup-github.sh`

Script automatizado para configurar o repositório no GitHub.

### `install-hooks.sh`

Script para instalar Git Hooks de proteção local.

### `test-gemini.mjs`

Script para testar conexão e funcionalidade da API do Google Gemini.

**O que faz:**
- ✅ Testa múltiplos modelos Gemini (2.0 Flash Exp, 1.5 Flash, 1.5 Pro)
- ✅ Verifica se a API key é válida
- ✅ Testa funcionalidade de chat
- ✅ Identifica problemas comuns (rate limit, modelo indisponível, etc)

**Uso:**

```bash
# Com variável de ambiente
GEMINI_API_KEY=your_key node scripts/test-gemini.mjs

# Ou passando como argumento
node scripts/test-gemini.mjs your_key
```

### `test-ai.mjs`

Script para testar todos os provedores de AI (OpenAI, Claude, Gemini).

**O que faz:**
- ✅ Verifica instalação do GitHub CLI
- ✅ Verifica autenticação
- ✅ Cria repositório no GitHub (público ou privado)
- ✅ Envia código inicial
- ✅ Cria e configura branch `develop`
- ✅ Adiciona tópicos relevantes ao repositório
- ✅ Opção para configurar proteção de branches

**Uso:**

```bash
./scripts/setup-github.sh
```

**Pré-requisitos:**
- GitHub CLI instalado (`brew install gh`)
- Autenticação configurada (`gh auth login`)

### `install-hooks.sh`

**O que faz:**
- ✅ Instala Git Hook pre-push
- ✅ Protege branch `main` contra pushes diretos localmente
- ✅ Força uso de Pull Requests

**Uso:**

```bash
./scripts/install-hooks.sh
```

**Nota:** Como o repositório é privado, proteção de branches via GitHub requer GitHub Pro. Este hook fornece proteção local.

---

## 🛠 Instalação do GitHub CLI

### macOS
```bash
brew install gh
```

### Windows
```bash
winget install GitHub.cli
```

Ou baixe em: https://cli.github.com/

### Autenticação
```bash
gh auth login
```

Escolha:
1. GitHub.com
2. HTTPS
3. Login via browser

---

## 📚 Comandos Úteis do GitHub CLI

### Repositório
```bash
# Ver informações do repo
gh repo view

# Abrir repo no navegador
gh repo view --web

# Clonar repo
gh repo clone USUARIO/REPO
```

### Issues
```bash
# Listar issues
gh issue list

# Criar issue
gh issue create

# Ver issue específica
gh issue view NUMERO
```

### Pull Requests
```bash
# Criar PR
gh pr create

# Listar PRs
gh pr list

# Ver PR específico
gh pr view NUMERO

# Fazer checkout de PR
gh pr checkout NUMERO

# Merge de PR
gh pr merge NUMERO
```

### Releases
```bash
# Listar releases
gh release list

# Criar release
gh release create v1.0.0

# Upload de assets
gh release upload v1.0.0 dist/*.dmg dist/*.exe
```

### Workflows (Actions)
```bash
# Listar workflows
gh workflow list

# Ver runs de um workflow
gh run list

# Ver detalhes de um run
gh run view RUN_ID
```

---

## 🔄 Fluxo de Trabalho Recomendado

### 1. Criar uma nova feature

```bash
# Atualizar develop
git checkout develop
git pull origin develop

# Criar branch da feature
git checkout -b feature/minha-feature

# Desenvolver...
git add .
git commit -m "feat: adiciona minha feature"

# Enviar para GitHub
git push -u origin feature/minha-feature

# Criar PR
gh pr create --base develop --title "Adiciona minha feature" --body "Descrição..."
```

### 2. Revisar e fazer merge

```bash
# Ver PR
gh pr view

# Fazer checkout para testar
gh pr checkout NUMERO

# Aprovar e fazer merge
gh pr merge NUMERO --merge
```

### 3. Criar release

```bash
# Atualizar main com develop
git checkout main
git merge develop
git push origin main

# Criar tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Criar release no GitHub
gh release create v1.0.0 \
  --title "v1.0.0 - Nome da Release" \
  --notes "Changelog aqui..." \
  dist/*.dmg dist/*.exe
```

---

## 🎯 Commits Semânticos

Use prefixos nos commits para melhor organização:

- `feat:` - Nova funcionalidade
- `fix:` - Correção de bug
- `docs:` - Documentação
- `style:` - Formatação, ponto e vírgula, etc
- `refactor:` - Refatoração de código
- `perf:` - Melhorias de performance
- `test:` - Adição de testes
- `chore:` - Tarefas de manutenção
- `ci:` - Mudanças no CI/CD
- `build:` - Mudanças no sistema de build

**Exemplos:**
```bash
git commit -m "feat: adiciona renderização de kline"
git commit -m "fix: corrige cálculo de média móvel"
git commit -m "docs: atualiza README com instruções"
git commit -m "perf: otimiza renderização de canvas"
```

---

## 🌿 Estratégia de Branches

```
main (produção - sempre estável)
  ← develop (integração)
      ← feature/nome-da-feature
      ← feature/outra-feature
      ← bugfix/nome-do-bug
```

**Regras:**
- `main` - Código de produção, apenas via PR
- `develop` - Branch de desenvolvimento principal
- `feature/*` - Novas funcionalidades
- `bugfix/*` - Correções de bugs
- `hotfix/*` - Correções urgentes em produção

---

## 📦 Publicação de Releases

### Automático (via GitHub Actions)

Ao criar uma tag, o CI/CD automaticamente:
1. Faz build para macOS e Windows
2. Assina os binários
3. Cria release no GitHub
4. Faz upload dos instaladores
5. Atualiza `latest.yml` para auto-update

### Manual

```bash
# Build local
npm run build:all

# Criar release
gh release create v1.0.0 \
  --title "v1.0.0 - Initial Release" \
  --notes-file CHANGELOG.md \
  dist-electron/*.dmg \
  dist-electron/*.exe \
  dist-electron/latest-mac.yml \
  dist-electron/latest.yml
```

---

## 🔧 Troubleshooting

### GitHub CLI não encontrado
```bash
# Verificar instalação
which gh

# Reinstalar
brew reinstall gh
```

### Não autenticado
```bash
# Re-autenticar
gh auth logout
gh auth login
```

### Erro ao criar repositório
```bash
# Verificar se já existe
gh repo view USUARIO/REPO

# Verificar permissões
gh auth status
```

---

Voltar para [README principal](../README.md)

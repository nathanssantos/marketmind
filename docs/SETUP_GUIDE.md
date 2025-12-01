# 🚀 MarketMind - Guia de Setup Completo

Guia passo a passo para rodar o projeto MarketMind localmente.

## 📋 Pré-requisitos

### Software Necessário

```bash
# Node.js 20+ (recomendado usar nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# pnpm 9+
npm install -g pnpm@9

# PostgreSQL 17 (via Homebrew no macOS)
brew install postgresql@17
brew services start postgresql@17

# OU via Docker (recomendado)
docker pull timescale/timescaledb:latest-pg17
```

---

## 🔧 Setup do Projeto

### 1. Clone e Instalação

```bash
# Clone o repositório
git clone https://github.com/nathanssantos/marketmind.git
cd marketmind

# Instale todas as dependências (monorepo completo)
pnpm install

# Verifique se tudo instalou corretamente
pnpm --version  # Deve ser 9.x
node --version  # Deve ser 20.x
```

### 2. Configure as Variáveis de Ambiente

#### Frontend (.env na raiz do projeto)

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite o arquivo .env
nano .env  # ou code .env
```

**Variáveis necessárias para rodar:**

```bash
# ===========================
# APIs de IA (Escolha PELO MENOS UMA)
# ===========================

# Opção 1: Anthropic Claude (Recomendado)
VITE_ANTHROPIC_API_KEY=sk-ant-api03-xxx
# Obtenha em: https://console.anthropic.com/settings/keys

# Opção 2: OpenAI GPT-4
VITE_OPENAI_API_KEY=sk-proj-xxx
# Obtenha em: https://platform.openai.com/api-keys

# Opção 3: Google Gemini
VITE_GEMINI_API_KEY=AIzaXXX
# Obtenha em: https://aistudio.google.com/apikey

# ===========================
# APIs de Mercado (OPCIONAL para testes)
# ===========================

# Binance (opcional - sem key usa dados demo)
BINANCE_API_KEY=
BINANCE_API_SECRET=

# ===========================
# APIs de Notícias (OPCIONAL)
# ===========================

# NewsAPI
VITE_NEWSAPI_API_KEY=
# Obtenha em: https://newsapi.org/register

# Debug (opcional)
VITE_DEBUG_SETUPS=false
NODE_ENV=development
```

#### Backend (.env em apps/backend/)

```bash
# Copie o arquivo de exemplo
cp apps/backend/.env.example apps/backend/.env

# Edite o arquivo
nano apps/backend/.env  # ou code apps/backend/.env
```

**Variáveis necessárias para rodar:**

```bash
# ===========================
# Ambiente
# ===========================
NODE_ENV=development
PORT=3001
HOST=0.0.0.0
LOG_LEVEL=info

# ===========================
# Database (PostgreSQL + TimescaleDB)
# ===========================

# Opção 1: PostgreSQL local
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/marketmind

# Opção 2: Docker (se usar docker-compose up)
# DATABASE_URL=postgresql://marketmind:password@localhost:5432/marketmind

# ===========================
# Segurança (GERE NOVAS KEYS!)
# ===========================

# Gere com: openssl rand -hex 32
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Gere com: openssl rand -hex 64
SESSION_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# ===========================
# CORS (Frontend URL)
# ===========================
CORS_ORIGIN=http://localhost:5173

# ===========================
# Redis (OPCIONAL - comentar se não usar)
# ===========================
# REDIS_URL=redis://:password@localhost:6379
# REDIS_PASSWORD=password

# ===========================
# Rate Limiting
# ===========================
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

### 3. Gere as Keys de Segurança

```bash
# Gere ENCRYPTION_KEY (32 bytes = 64 caracteres hex)
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"

# Gere SESSION_SECRET (64 bytes = 128 caracteres hex)
echo "SESSION_SECRET=$(openssl rand -hex 64)"

# Copie os valores gerados para apps/backend/.env
```

---

## 🗄️ Setup do Banco de Dados

### Opção 1: PostgreSQL Local (Sem Docker)

```bash
# Crie o banco de dados
psql postgres -c "CREATE DATABASE marketmind;"

# Habilite TimescaleDB (se instalado)
psql marketmind -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"

# Execute as migrations
cd apps/backend
pnpm db:generate  # Gera migrations do Drizzle
pnpm db:migrate   # Aplica migrations

# Volte para raiz
cd ../..
```

### Opção 2: Docker (Recomendado)

```bash
# Inicie PostgreSQL + TimescaleDB via Docker Compose
docker-compose up -d postgres

# Aguarde alguns segundos para o banco inicializar
sleep 10

# Execute as migrations
cd apps/backend
pnpm db:migrate

# Volte para raiz
cd ../..
```

---

## ▶️ Rodando o Projeto

### Modo Desenvolvimento (Recomendado)

#### Terminal 1 - Backend

```bash
# Inicie o backend
pnpm --filter @marketmind/backend dev

# Aguarde a mensagem:
# 🚀 Backend server running on http://localhost:3001
# 📡 tRPC endpoint: http://localhost:3001/trpc
# 🔌 WebSocket server initialized
```

#### Terminal 2 - Frontend (Electron)

```bash
# Inicie o frontend
pnpm --filter @marketmind/electron dev

# O app Electron abrirá automaticamente
```

### Modo Produção (Docker)

```bash
# Build e inicie todos os serviços
docker-compose up -d

# Veja os logs
docker-compose logs -f

# Acesse:
# - Backend API: http://localhost:3001
# - Frontend: Rode o Electron separadamente
```

---

## ✅ Verificação do Setup

### 1. Teste o Backend

```bash
# Health check
curl http://localhost:3001/health

# Deve retornar:
# {"status":"ok","timestamp":"2025-11-30T...","version":"0.31.0"}

# API info
curl http://localhost:3001/

# Teste tRPC (se autenticado)
curl http://localhost:3001/trpc/health.check
```

### 2. Teste o Frontend

- **Abra o app Electron**
- **Configure uma API key de IA** (Settings → AI)
- **Teste o chat com IA**
- **Visualize um chart** (BTC/USDT)
- **Teste detecção de setups**

### 3. Execute os Testes

```bash
# Todos os testes (1,967 testes)
pnpm test

# Apenas frontend
pnpm --filter @marketmind/electron test

# Apenas backend
pnpm --filter @marketmind/backend test

# Apenas indicators
pnpm --filter @marketmind/indicators test
```

---

## 🔑 Como Obter as API Keys

### 1. Anthropic Claude (Recomendado) ⭐

```
1. Acesse: https://console.anthropic.com
2. Faça login ou crie uma conta
3. Vá em Settings → API Keys
4. Clique em "Create Key"
5. Copie a key (sk-ant-api03-...)
6. Cole em .env: VITE_ANTHROPIC_API_KEY=sk-ant-api03-...

Preço: ~$3 per 1M tokens (input), $15 per 1M tokens (output)
Modelo: claude-sonnet-4-20250514 (padrão no app)
```

### 2. OpenAI GPT-4 (Alternativa)

```
1. Acesse: https://platform.openai.com/api-keys
2. Faça login com sua conta OpenAI
3. Clique em "Create new secret key"
4. Dê um nome (ex: "MarketMind")
5. Copie a key (sk-proj-...)
6. Cole em .env: VITE_OPENAI_API_KEY=sk-proj-...

Preço: ~$2.50 per 1M tokens (input), $10 per 1M tokens (output)
Modelo: gpt-4o (padrão no app)
```

### 3. Google Gemini (Alternativa Gratuita)

```
1. Acesse: https://aistudio.google.com/apikey
2. Faça login com conta Google
3. Clique em "Create API Key"
4. Copie a key (AIza...)
5. Cole em .env: VITE_GEMINI_API_KEY=AIza...

Preço: GRATUITO até 1,500 req/day
Modelo: gemini-2.0-flash-exp (padrão no app)
```

### 4. Binance (OPCIONAL)

```
1. Acesse: https://www.binance.com/en/my/settings/api-management
2. Crie uma API key
3. Configure permissões (Read only para começar)
4. Copie API Key e Secret
5. Cole em .env:
   BINANCE_API_KEY=...
   BINANCE_API_SECRET=...

NOTA: Sem API key, o app usa dados demo da Binance API pública
```

---

## 🐛 Troubleshooting

### Backend não inicia

```bash
# Verifique se a porta 3001 está livre
lsof -ti:3001 | xargs kill -9

# Verifique a conexão com o banco
psql "postgresql://postgres:postgres@localhost:5432/marketmind" -c "SELECT 1;"

# Verifique os logs
pnpm --filter @marketmind/backend dev 2>&1 | tee backend.log
```

### Frontend não conecta ao backend

```bash
# Verifique se o backend está rodando
curl http://localhost:3001/health

# Verifique CORS em apps/backend/.env
# CORS_ORIGIN deve ser http://localhost:5173
```

### Erro de migração do banco

```bash
# Reset do banco (CUIDADO: apaga dados)
cd apps/backend
pnpm db:drop    # Apaga todas tabelas
pnpm db:push    # Recria schema
pnpm db:migrate # Aplica migrations
```

### Testes falhando

```bash
# Limpe e reinstale dependências
pnpm clean
rm -rf node_modules
pnpm install

# Execute testes novamente
pnpm test
```

---

## 📚 Próximos Passos

1. **Configure pelo menos 1 API key de IA** (Anthropic, OpenAI ou Gemini)
2. **Inicie backend e frontend** em terminais separados
3. **Teste o chat com IA** na interface
4. **Explore os setups de trading** (Setup 9.1, 9.2, 9.3, 9.4)
5. **Leia a documentação** em `docs/`

---

## 📖 Documentação Adicional

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deploy em produção
- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** - Roadmap do projeto
- **[BACKEND_INTEGRATION_STATUS.md](./BACKEND_INTEGRATION_STATUS.md)** - Status do backend
- **[WEBSOCKET_REALTIME_SETUPS.md](./WEBSOCKET_REALTIME_SETUPS.md)** - WebSocket real-time

---

## 💬 Suporte

- **GitHub Issues**: https://github.com/nathanssantos/marketmind/issues
- **Discord**: [Em breve]

**Versão**: 0.31.0  
**Última Atualização**: 30 de Novembro de 2025

# 📊 MarketMind

> Um consultor de IA para análise técnica de gráficos financeiros

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)

</div>

## 🎯 Sobre o Projeto

**MarketMind** é uma aplicação desktop desenvolvida em Electron que combina visualização avançada de gráficos financeiros (candlesticks) com análise de inteligência artificial. O objetivo é fornecer insights sobre criptomoedas, ações e outros ativos negociáveis, auxiliando traders e investidores na tomada de decisão.

### Principais Funcionalidades

- 📈 **Gráficos de Alta Performance**: Renderização em Canvas com suporte a candlesticks e gráficos de linha
- 🤖 **Análise com IA**: Integração com múltiplos provedores de IA (OpenAI, Anthropic, Google Gemini)
- 📰 **Análise de Notícias**: Cruzamento de análise técnica com sentimento de notícias
- 💬 **Chat Interativo**: Converse com a IA sobre os gráficos em tempo real
- 📊 **Indicadores Técnicos**: Médias móveis (SMA/EMA), volume e muito mais
- 🌓 **Temas**: Suporte completo a modo claro e escuro
- 🔄 **Auto-Update**: Sistema automático de atualizações

## 🛠 Stack Tecnológica

- **TypeScript** - Tipagem end-to-end
- **Electron** - Framework desktop multiplataforma
- **React 18** - Interface do usuário
- **Chakra UI** - Componentes e sistema de design
- **Canvas API** - Renderização de gráficos de alta performance
- **Vite** - Build tool otimizado

## 📋 Pré-requisitos

- Node.js >= 18.x
- npm >= 9.x (ou pnpm/yarn)
- macOS 10.15+ ou Windows 10+

## 🚀 Instalação para Desenvolvimento

### 1. Clone o repositório

```bash
git clone https://github.com/SEU_USUARIO/marketmind.git
cd marketmind
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# APIs de Mercado (opcional - pode configurar via interface)
BINANCE_API_KEY=sua_key_aqui
ALPHA_VANTAGE_API_KEY=sua_key_aqui

# APIs de IA (opcional - pode configurar via interface)
OPENAI_API_KEY=sua_key_aqui
ANTHROPIC_API_KEY=sua_key_aqui
GOOGLE_API_KEY=sua_key_aqui
```

> ⚠️ **Nota**: As API keys também podem ser configuradas diretamente pela interface do aplicativo.

### 4. Execute em modo desenvolvimento

```bash
npm run dev
```

## 📦 Build para Produção

### Build para sua plataforma atual

```bash
npm run build
```

### Build específico por plataforma

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Ambos
npm run build:all
```

Os instaladores estarão em `dist-electron/`.

## 🗂 Estrutura do Projeto

```
marketmind/
├── src/
│   ├── main/              # Processo principal do Electron
│   ├── renderer/          # Interface React
│   │   ├── components/    # Componentes React
│   │   ├── services/      # Serviços (AI, APIs de mercado)
│   │   ├── hooks/         # Custom hooks
│   │   └── theme/         # Configuração Chakra UI
│   └── shared/            # Tipos e código compartilhado
├── PLANO_IMPLEMENTACAO.md # Plano detalhado de desenvolvimento
└── package.json
```

## 🎨 Capturas de Tela

> Em breve...

## 🤝 Contribuindo

Este projeto está em desenvolvimento ativo. Contribuições são bem-vindas!

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📝 Roadmap

Veja o arquivo [PLANO_IMPLEMENTACAO.md](./PLANO_IMPLEMENTACAO.md) para o roadmap detalhado do projeto.

### MVP (v1.0)
- [x] Plano de implementação
- [ ] Setup do projeto
- [ ] Renderização de gráficos candlestick
- [ ] Integração com API de mercado
- [ ] Chat com IA
- [ ] Sistema de build e instaladores
- [ ] Auto-update

### Futuro (v1.1+)
- [ ] Mais indicadores técnicos (RSI, MACD, Bollinger Bands)
- [ ] Alertas de preço
- [ ] Watchlist de ativos
- [ ] Export de gráficos
- [ ] Suporte a múltiplos idiomas

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👥 Autores

- **Seu Nome** - *Desenvolvimento inicial* - [seu-github](https://github.com/SEU_USUARIO)

## 🙏 Agradecimentos

- Comunidade Electron
- Equipe do React e Chakra UI
- Provedores de APIs de mercado e IA

---

<div align="center">

**[Website](https://seusite.com)** • 
**[Documentação](./PLANO_IMPLEMENTACAO.md)** • 
**[Report Bug](https://github.com/SEU_USUARIO/marketmind/issues)** • 
**[Request Feature](https://github.com/SEU_USUARIO/marketmind/issues)**

Feito com ❤️ para traders e investidores

</div>

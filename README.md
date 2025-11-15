# 📊 MarketMind

> An AI consultant for technical analysis of financial charts

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)

</div>

## 🎯 About the Project

**MarketMind** is a desktop application developed in Electron that combines advanced financial chart visualization (candlesticks) with artificial intelligence analysis. The goal is to provide insights on cryptocurrencies, stocks, and other tradable assets, assisting traders and investors in decision-making.

### Key Features

- 📈 **High-Performance Charts**: Canvas rendering with support for candlesticks and line charts
- 🤖 **AI Analysis**: Integration with multiple AI providers (OpenAI, Anthropic, Google Gemini)
- 📰 **News Analysis**: Cross-analysis of technical analysis with news sentiment
- 💬 **Interactive Chat**: Chat with AI about charts in real-time
- 📊 **Technical Indicators**: Moving averages (SMA/EMA), volume, and more
- 🌓 **Themes**: Full support for light and dark mode
- 🔄 **Auto-Update**: Automatic update system

## 🛠 Technology Stack

- **TypeScript** - End-to-end typing
- **Electron** - Cross-platform desktop framework
- **React 19** - User interface
- **Chakra UI** - Components and design system
- **Canvas API** - High-performance chart rendering
- **Vite** - Optimized build tool

## 📋 Prerequisites

- Node.js >= 18.x
- npm >= 9.x (or pnpm/yarn)
- macOS 10.15+ or Windows 10+

## 🚀 Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/marketmind.git
cd marketmind
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
# Market APIs (optional - can be configured via interface)
BINANCE_API_KEY=your_key_here
ALPHA_VANTAGE_API_KEY=your_key_here

# AI APIs (optional - can be configured via interface)
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here
```

> ⚠️ **Note**: API keys can also be configured directly through the application interface.

### 4. Run in development mode

```bash
npm run dev
```

## 📦 Production Build

### Build for your current platform

```bash
npm run build
```

### Platform-specific builds

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Both
npm run build:all
```

Installers will be in `dist-electron/`.

## 🗂 Project Structure

```
marketmind/
├── src/
│   ├── main/              # Electron main process
│   ├── renderer/          # React interface
│   │   ├── components/    # React components
│   │   ├── services/      # Services (AI, market APIs)
│   │   ├── hooks/         # Custom hooks
│   │   └── theme/         # Chakra UI configuration
│   └── shared/            # Shared types and code
├── docs/                  # Documentation
│   ├── IMPLEMENTATION_PLAN.md  # Detailed development plan
│   └── ...
└── package.json
```

## 🎨 Screenshots

> Coming soon...

## 🤝 Contributing

This project is in active development. Contributions are welcome!

1. Fork the project
2. Create a feature branch (`git checkout -b feature/MyFeature`)
3. Commit your changes (`git commit -m 'Add MyFeature'`)
4. Push to the branch (`git push origin feature/MyFeature`)
5. Open a Pull Request

## 📝 Roadmap

See the [IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) file for the detailed project roadmap.

### MVP (v1.0)
- [x] Implementation plan
- [ ] Project setup
- [ ] Candlestick chart rendering
- [ ] Market API integration
- [ ] AI chat
- [ ] Build system and installers
- [ ] Auto-update

### Future (v1.1+)
- [ ] More technical indicators (RSI, MACD, Bollinger Bands)
- [ ] Price alerts
- [ ] Asset watchlist
- [ ] Chart export
- [ ] Multi-language support

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Nathan Santos** - *Initial development* - [nathanssantos](https://github.com/nathanssantos)

## 🙏 Acknowledgments

- Electron community
- React and Chakra UI teams
- Market and AI API providers

---

<div align="center">

**[Documentation](./docs/IMPLEMENTATION_PLAN.md)** • 
**[Report Bug](https://github.com/nathanssantos/marketmind/issues)** • 
**[Request Feature](https://github.com/nathanssantos/marketmind/issues)**

Made with ❤️ for traders and investors

</div>

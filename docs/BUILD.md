# Building MarketMind

This document explains how to build MarketMind installers for macOS and Windows.

## Prerequisites

### For macOS Builds
- macOS 10.13 or later
- Xcode Command Line Tools
- Node.js 18+ and npm/yarn

### For Windows Builds
- Windows 10 or later, OR
- macOS with Wine installed (for cross-platform builds)
- Node.js 18+ and npm/yarn

## Quick Start

### Build for Current Platform
```bash
npm run build
```

### Build for macOS Only
```bash
npm run build:mac
```

### Build for Windows Only
```bash
npm run build:win
```

### Build for All Platforms
```bash
npm run build:all
```

## Output

Build artifacts will be created in the `dist/` directory:

### macOS
- `MarketMind-{version}.dmg` - macOS installer
- `MarketMind-{version}-arm64.dmg` - Apple Silicon installer
- `MarketMind-{version}-mac.zip` - Portable macOS app

### Windows
- `MarketMind-Setup-{version}.exe` - Windows installer
- `MarketMind-Portable-{version}.exe` - Portable Windows app

## Code Signing (Optional)

### macOS
To sign the macOS app, you need:
1. Apple Developer account
2. Developer ID Application certificate installed in Keychain
3. Environment variables:

```bash
export APPLE_ID="your-apple-id@email.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="your-team-id"
```

### Windows
To sign the Windows app, you need:
1. Code signing certificate (.pfx or .p12)
2. Environment variables:

```bash
export CSC_LINK="path/to/certificate.pfx"
export CSC_KEY_PASSWORD="certificate-password"
```

## Troubleshooting

### "Icon not found" Error
Make sure you've generated the icon files:
```bash
cd build && ./create-simple-icons.sh
```

### Build Takes Too Long
The first build downloads Electron binaries (~200MB) and can take 5-10 minutes. Subsequent builds are much faster (~2-3 minutes).

### "Permission denied" on macOS
If you get permission errors, try:
```bash
chmod +x build/create-simple-icons.sh
```

### Windows Build on macOS
Cross-platform Windows builds on macOS require Wine:
```bash
brew install wine-stable
```

## CI/CD Integration

For automated builds on GitHub Actions, see `.github/workflows/build.yml` (coming soon).

## Customization

### Icons
Replace the placeholder icons in `build/` with your own:
- `icon.icns` - macOS icon
- `icon-256.png` - Windows icon  
- `icon.png` - Linux icon

See `build/README.md` for instructions on generating proper icons.

### Build Configuration
Edit `electron-builder.config.js` to customize:
- App ID and product name
- Build targets and architectures
- Installer options
- Code signing settings
- Auto-update configuration

## Resources

- [electron-builder Documentation](https://www.electron.build/)
- [macOS Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Windows Code Signing](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)

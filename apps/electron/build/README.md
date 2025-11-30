# Build Assets

This directory contains assets required for building MarketMind installers.

## Required Files

### Icons

You need to provide the following icon files:

#### macOS
- **icon.icns** - macOS application icon
  - Required sizes: 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024
  - Generate with: `iconutil -c icns icon.iconset`

#### Windows
- **icon.ico** - Windows application icon
  - Required sizes: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256
  - Can be created with tools like ImageMagick or online converters

#### Linux
- **icon.png** - Linux application icon
  - Recommended size: 512x512 or 1024x1024

### DMG Background (Optional)
- **background.png** - Background image for macOS DMG installer
  - Recommended size: 540x380

## Generating Icons

### From PNG Source

If you have a source PNG (e.g., `icon-source.png` at 1024x1024):

#### macOS (.icns)
```bash
# Create iconset directory
mkdir icon.iconset

# Generate all required sizes
sips -z 16 16     icon-source.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon-source.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon-source.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon-source.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon-source.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon-source.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon-source.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon-source.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon-source.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon-source.png --out icon.iconset/icon_512x512@2x.png

# Convert to .icns
iconutil -c icns icon.iconset

# Clean up
rm -rf icon.iconset
```

#### Windows (.ico)
Using ImageMagick:
```bash
convert icon-source.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

#### Linux (.png)
```bash
cp icon-source.png icon.png
```

## Current Files

- ✅ `entitlements.mac.plist` - macOS entitlements for code signing
- ✅ `installer.nsh` - Windows NSIS installer customization script
- ⏳ `icon.icns` - macOS icon (needs to be created)
- ⏳ `icon.ico` - Windows icon (needs to be created)
- ⏳ `icon.png` - Linux icon (needs to be created)
- ⏳ `background.png` - DMG background (optional)

## Code Signing

### macOS
To enable code signing and notarization, you need:
1. Apple Developer account
2. Developer ID Application certificate
3. App-specific password for notarization

Set the following environment variables:
```bash
export APPLE_ID="your-apple-id@email.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="your-team-id"
```

### Windows
To enable code signing, you need:
1. Code signing certificate (.pfx or .p12)
2. Certificate password

Set the following environment variables:
```bash
export CSC_LINK="path/to/certificate.pfx"
export CSC_KEY_PASSWORD="certificate-password"
```

## Building

### Development Build (no signing)
```bash
npm run build:mac    # macOS only
npm run build:win    # Windows only
npm run build:all    # All platforms
```

### Production Build (with signing)
1. Set up environment variables (see above)
2. Run build commands

The installers will be created in the `release/` directory.

## Troubleshooting

### "icon.icns not found"
Create the icon files using the instructions above.

### "Notarization failed"
Make sure all environment variables are set correctly and you have a valid Apple Developer account.

### "Code signing failed"
Verify that your certificate is valid and the password is correct.

## Resources

- [electron-builder Documentation](https://www.electron.build/)
- [macOS Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Windows Code Signing](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)

#!/bin/bash

echo "Creating simple placeholder icons for MarketMind..."

# Create a basic 1024x1024 PNG using macOS native tools
# We'll create a simple colored square as a placeholder
cat > icon-source.svg << 'SVG'
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1f2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2a3f5e;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#grad1)"/>
  <circle cx="512" cy="512" r="400" fill="#2196f3" stroke="#64b5f6" stroke-width="8"/>
  <text x="512" y="650" font-family="Helvetica" font-size="380" font-weight="bold" fill="white" text-anchor="middle">MM</text>
</svg>
SVG

# Convert SVG to PNG using qlmanage or sips
/usr/bin/qlmanage -t -s 1024 -o . icon-source.svg > /dev/null 2>&1
mv icon-source.svg.png icon-source.png 2>/dev/null || true

# If qlmanage didn't work, create a simple colored PNG
if [ ! -f "icon-source.png" ]; then
    # Create using sips and a temporary file
    echo "Creating basic placeholder..."
    # Create a 1x1 blue pixel and scale it
    printf '\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90\x77\x53\xde\x00\x00\x00\x0c\x49\x44\x41\x54\x08\xd7\x63\x60\xa8\xb8\x00\x00\x00\x04\x00\x01\x14\x0d\x28\x2a\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82' > pixel.png
    sips -z 1024 1024 pixel.png --out icon-source.png > /dev/null 2>&1
    rm pixel.png
fi

echo "✓ Created icon-source.png"

# Create icon.png for Linux (just copy the source)
cp icon-source.png icon.png
echo "✓ Created icon.png for Linux"

# Create macOS .icns
echo "Creating macOS .icns file..."
mkdir -p icon.iconset

sips -z 16 16     icon-source.png --out icon.iconset/icon_16x16.png > /dev/null 2>&1
sips -z 32 32     icon-source.png --out icon.iconset/icon_16x16@2x.png > /dev/null 2>&1
sips -z 32 32     icon-source.png --out icon.iconset/icon_32x32.png > /dev/null 2>&1
sips -z 64 64     icon-source.png --out icon.iconset/icon_32x32@2x.png > /dev/null 2>&1
sips -z 128 128   icon-source.png --out icon.iconset/icon_128x128.png > /dev/null 2>&1
sips -z 256 256   icon-source.png --out icon.iconset/icon_128x128@2x.png > /dev/null 2>&1
sips -z 256 256   icon-source.png --out icon.iconset/icon_256x256.png > /dev/null 2>&1
sips -z 512 512   icon-source.png --out icon.iconset/icon_256x256@2x.png > /dev/null 2>&1
sips -z 512 512   icon-source.png --out icon.iconset/icon_512x512.png > /dev/null 2>&1
sips -z 1024 1024 icon-source.png --out icon.iconset/icon_512x512@2x.png > /dev/null 2>&1

iconutil -c icns icon.iconset
rm -rf icon.iconset
echo "✓ Created icon.icns for macOS"

# For Windows .ico, we'll create a simple multi-size icon
# electron-builder can work with PNG, so we'll create that
cp icon-source.png icon.ico.png
sips -z 256 256 icon-source.png --out icon-256.png > /dev/null 2>&1
echo "✓ Created icon files for Windows (builder will convert)"

# Create DMG background
cp icon-source.png background.png
sips -z 380 540 background.png > /dev/null 2>&1
echo "✓ Created background.png for DMG"

echo ""
echo "Placeholder icons created!"
echo "Note: These are basic placeholders. Replace with professional icons later."

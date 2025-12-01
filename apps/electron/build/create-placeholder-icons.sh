#!/bin/bash

echo "Creating placeholder icons for MarketMind..."

# Create a simple 1024x1024 PNG placeholder using Python
python3 << 'PYTHON'
from PIL import Image, ImageDraw, ImageFont
import os

# Create 1024x1024 image with gradient background
size = 1024
img = Image.new('RGB', (size, size), color='#1a1f2e')
draw = ImageDraw.Draw(img)

# Draw gradient effect
for y in range(size):
    color_value = int(26 + (y / size) * 40)
    draw.line([(0, y), (size, y)], fill=(color_value, color_value + 5, color_value + 15))

# Draw circle
circle_radius = 400
circle_center = (size // 2, size // 2)
draw.ellipse(
    [circle_center[0] - circle_radius, circle_center[1] - circle_radius,
     circle_center[0] + circle_radius, circle_center[1] + circle_radius],
    fill='#2196f3', outline='#64b5f6', width=8
)

# Draw "MM" text
try:
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 380)
except:
    font = ImageFont.load_default()

text = "MM"
bbox = draw.textbbox((0, 0), text, font=font)
text_width = bbox[2] - bbox[0]
text_height = bbox[3] - bbox[1]
text_x = (size - text_width) // 2
text_y = (size - text_height) // 2 - 20

draw.text((text_x, text_y), text, fill='white', font=font)

# Save PNG
img.save('icon-source.png')
print("✓ Created icon-source.png (1024x1024)")

# Save as icon.png for Linux
img.save('icon.png')
print("✓ Created icon.png for Linux")

PYTHON

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

# Create Windows .ico using Python
python3 << 'PYTHON'
from PIL import Image

img = Image.open('icon-source.png')
sizes = [(16,16), (32,32), (48,48), (64,64), (128,128), (256,256)]
img.save('icon.ico', format='ICO', sizes=sizes)
print("✓ Created icon.ico for Windows")
PYTHON

# Create DMG background (540x380)
python3 << 'PYTHON'
from PIL import Image, ImageDraw, ImageFont

size = (540, 380)
img = Image.new('RGB', size, color='#1a1f2e')
draw = ImageDraw.Draw(img)

# Draw gradient
for y in range(size[1]):
    color_value = int(26 + (y / size[1]) * 30)
    draw.line([(0, y), (size[0], y)], fill=(color_value, color_value + 5, color_value + 15))

# Draw subtle text
try:
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
except:
    font = ImageFont.load_default()

text = "Drag MarketMind to Applications"
bbox = draw.textbbox((0, 0), text, font=font)
text_width = bbox[2] - bbox[0]
text_x = (size[0] - text_width) // 2

draw.text((text_x, 40), text, fill=(255, 255, 255, 128), font=font)

img.save('background.png')
print("✓ Created background.png for DMG")
PYTHON

echo ""
echo "All placeholder icons created successfully!"
echo "Files created:"
echo "  - icon.icns (macOS)"
echo "  - icon.ico (Windows)"
echo "  - icon.png (Linux)"
echo "  - background.png (DMG background)"
echo ""

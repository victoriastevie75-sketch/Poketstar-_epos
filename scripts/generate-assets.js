/**
 * Generate native Windows icon and manifest for Poket Star POS
 */

const fs = require('fs');
const path = require('path');

// 1. Generate 32x32 RGBA icon buffer
const width = 32;
const height = 32;
const bpp = 32;
const imageSize = width * height * 4;
const maskSize = Math.ceil(width / 32) * 4 * height; // 1bpp row aligned to 4 bytes

const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // Type 1 = ICO
icoHeader.writeUInt16LE(1, 4); // 1 Image

const icoDirEntry = Buffer.alloc(16);
icoDirEntry.writeUInt8(width, 0);
icoDirEntry.writeUInt8(height, 1);
icoDirEntry.writeUInt8(0, 2); // Color palette (0 = no palette)
icoDirEntry.writeUInt8(0, 3); // Reserved
icoDirEntry.writeUInt16LE(1, 4); // Color planes
icoDirEntry.writeUInt16LE(bpp, 6); // Bits per pixel
const totalBitmapSize = 40 + imageSize + maskSize;
icoDirEntry.writeUInt32LE(totalBitmapSize, 8); // Size of image data
icoDirEntry.writeUInt32LE(6 + 16, 12); // Offset to image data

// BITMAPINFOHEADER
const bmiHeader = Buffer.alloc(40);
bmiHeader.writeUInt32LE(40, 0); // Header size
bmiHeader.writeInt32LE(width, 4); // Width
bmiHeader.writeInt32LE(height * 2, 8); // Height (doubled in ICO: XOR mask + AND mask)
bmiHeader.writeUInt16LE(1, 12); // Planes
bmiHeader.writeUInt16LE(bpp, 14); // BitCount
bmiHeader.writeUInt32LE(0, 16); // Compression (BI_RGB)
bmiHeader.writeUInt32LE(imageSize + maskSize, 20); // Image size
bmiHeader.writeInt32LE(0, 24); // XPelsPerMeter
bmiHeader.writeInt32LE(0, 28); // YPelsPerMeter
bmiHeader.writeUInt32LE(0, 32); // ClrUsed
bmiHeader.writeUInt32LE(0, 36); // ClrImportant

// Pixel data: Emerald green circle with gold star in center (bottom-to-top order)
const pixelData = Buffer.alloc(imageSize);
const andMask = Buffer.alloc(maskSize, 0); // 0 = opaque, 1 = transparent

const cx = width / 2;
const cy = height / 2;
const radius = 14;

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    // BMP is bottom-up: y=0 is bottom row
    const actualY = height - 1 - y;
    const dx = x - cx;
    const dy = actualY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const pixelIdx = (y * width + x) * 4;

    if (dist <= radius) {
      // Inside circular emblem
      const isCenter = dist <= 6;
      if (isCenter) {
        // Gold / Amber Star color: #f59e0b (RGB: 245, 158, 11) -> BGRA in BMP
        pixelData[pixelIdx] = 11;     // Blue
        pixelData[pixelIdx + 1] = 158; // Green
        pixelData[pixelIdx + 2] = 245; // Red
        pixelData[pixelIdx + 3] = 255; // Alpha
      } else {
        // Emerald Green: #059669 (RGB: 5, 150, 105) -> BGRA
        pixelData[pixelIdx] = 105;   // Blue
        pixelData[pixelIdx + 1] = 150; // Green
        pixelData[pixelIdx + 2] = 5;   // Red
        pixelData[pixelIdx + 3] = 255; // Alpha
      }
    } else {
      // Transparent outside
      pixelData[pixelIdx] = 0;
      pixelData[pixelIdx + 1] = 0;
      pixelData[pixelIdx + 2] = 0;
      pixelData[pixelIdx + 3] = 0;

      // Set bit in AND mask for transparency
      const maskRowBytes = Math.ceil(width / 32) * 4;
      const maskByteIdx = y * maskRowBytes + Math.floor(x / 8);
      const maskBit = 7 - (x % 8);
      andMask[maskByteIdx] |= (1 << maskBit);
    }
  }
}

const icoBuffer = Buffer.concat([icoHeader, icoDirEntry, bmiHeader, pixelData, andMask]);
const iconPath = path.join(__dirname, '../src_native/app.ico');
fs.writeFileSync(iconPath, icoBuffer);
console.log('Generated Windows Icon:', iconPath, 'Size:', icoBuffer.length);

// 2. Generate application manifest
const manifestContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity version="2.4.0.0" processorArchitecture="*" name="PoketStar.POS.Terminal" type="win32"/>
  <description>Poket Star POS Standalone Terminal</description>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2, PerMonitor</dpiAwareness>
    </windowsSettings>
  </application>
</assembly>
`;

const manifestPath = path.join(__dirname, '../src_native/app.manifest');
fs.writeFileSync(manifestPath, manifestContent);
console.log('Generated Windows Manifest:', manifestPath);

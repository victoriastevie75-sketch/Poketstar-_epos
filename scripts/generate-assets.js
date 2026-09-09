/**
 * Generate native Windows icon and manifest for Poket Star POS
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const officialLogoPath = path.join(root, 'src/assets/images/pocket_star_gold_silver_official_1785328099213.jpg');

let generatedWithConvert = false;
if (fs.existsSync(officialLogoPath)) {
  try {
    const icoPath = path.join(root, 'src_native/app.ico');
    execSync(`convert "${officialLogoPath}" -define icon:auto-resize=256,128,64,48,32,16 "${icoPath}"`);
    execSync(`convert "${officialLogoPath}" -resize 512x512 "${path.join(root, 'pwa-512x512.png')}"`);
    execSync(`convert "${officialLogoPath}" -resize 192x192 "${path.join(root, 'pwa-192x192.png')}"`);
    execSync(`convert "${officialLogoPath}" -resize 180x180 "${path.join(root, 'apple-touch-icon.png')}"`);
    execSync(`convert "${officialLogoPath}" -define icon:auto-resize=64,48,32,16 "${path.join(root, 'favicon.ico')}"`);
    console.log('Successfully generated all desktop icons from official Poket Star app logo!');
    generatedWithConvert = true;
  } catch (err) {
    console.warn('ImageMagick convert not available, falling back to procedural icon generation:', err.message);
  }
}

// 1. Generate 32x32 RGBA icon buffer (Fallback if convert absent)
if (!generatedWithConvert) {
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
}

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

// 3. Generate standard PWA PNG Icons
const zlib = require('zlib');

function generatePng(width, height) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const payload = Buffer.concat([typeBuf, data]);
    let c = 0xFFFFFFFF;
    for (let i = 0; i < payload.length; i++) {
      c ^= payload[i];
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
    }
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE((c ^ 0xFFFFFFFF) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(rowBytes * height);
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.44;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        if (dist <= radius * 0.48) {
          rawData[pxOffset] = 223;     // Gold / Amber
          rawData[pxOffset + 1] = 177;
          rawData[pxOffset + 2] = 91;
          rawData[pxOffset + 3] = 255;
        } else {
          rawData[pxOffset] = 11;      // Dark theme background
          rawData[pxOffset + 1] = 13;
          rawData[pxOffset + 2] = 20;
          rawData[pxOffset + 3] = 255;
        }
      } else {
        rawData[pxOffset] = 11;
        rawData[pxOffset + 1] = 13;
        rawData[pxOffset + 2] = 20;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

if (!generatedWithConvert) {
  const png192 = generatePng(192, 192);
  const png512 = generatePng(512, 512);

  const dirs = [root, path.join(root, 'dist'), path.join(root, 'web')];
  dirs.forEach(d => {
    if (fs.existsSync(d)) {
      fs.writeFileSync(path.join(d, 'pwa-192x192.png'), png192);
      fs.writeFileSync(path.join(d, 'pwa-512x512.png'), png512);
      fs.writeFileSync(path.join(d, 'apple-touch-icon.png'), png192);
    }
  });
  console.log('Generated PWA Icons: pwa-192x192.png, pwa-512x512.png, apple-touch-icon.png');
} else {
  // Sync high-res icons to dist and web
  const dirs = [path.join(root, 'dist'), path.join(root, 'web')];
  dirs.forEach(d => {
    if (fs.existsSync(d)) {
      ['pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png', 'favicon.ico'].forEach(file => {
        const srcF = path.join(root, file);
        if (fs.existsSync(srcF)) fs.copyFileSync(srcF, path.join(d, file));
      });
    }
  });
}


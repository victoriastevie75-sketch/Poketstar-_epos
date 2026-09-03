#!/usr/bin/env node
/**
 * Poketstar POS Server
 * Unified Express server for serving the POS desktop environment & web demo APIs
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
let compression;
try {
  compression = require('compression');
} catch (e) {
  // fallback if compression module is absent
}
const app = express();

// High Performance Gzip Compression (excluding binary downloads to prevent corruption)
if (compression) {
  app.use(compression({
    level: 6,
    filter: (req, res) => {
      const p = req.path || '';
      if (p.startsWith('/download') || p.endsWith('.exe') || p.endsWith('.zip')) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Fast In-Memory Cache for index.html
let cachedIndexHtml = null;
let cachedIndexMtime = null;

function getIndexHtml() {
  const indexPath = path.join(__dirname, 'index.html');
  try {
    const stats = fs.statSync(indexPath);
    if (!cachedIndexHtml || cachedIndexMtime !== stats.mtimeMs) {
      cachedIndexHtml = fs.readFileSync(indexPath, 'utf8');
      cachedIndexMtime = stats.mtimeMs;
    }
  } catch (err) {
    if (!cachedIndexHtml) {
      try {
        cachedIndexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
      } catch (e) {}
    }
  }
  return cachedIndexHtml;
}

// Pre-warm the cache
getIndexHtml();

// Serve static assets with caching headers
app.use(express.static(path.join(__dirname), { maxAge: '1h' }));
app.use('/web', express.static(path.join(__dirname, 'web'), { maxAge: '1h' }));

// Mount API routes with error handling
try {
  const authRoutes = require('./server/routes/auth.routes');
  app.use('/api/auth', authRoutes);
  console.log('[Server] ✓ Auth routes loaded');
} catch (e) {
  console.warn('[Server] ⚠ Auth routes not available:', e.message);
}

try {
  const paymentsRoutes = require('./server/routes/payments.routes');
  app.use('/api/payments', paymentsRoutes);
  console.log('[Server] ✓ Payments routes loaded');
} catch (e) {
  console.warn('[Server] ⚠ Payments routes not available:', e.message);
}

try {
  const productsRoutes = require('./server/routes/products.routes');
  app.use('/api/products', productsRoutes);
  console.log('[Server] ✓ Products routes loaded');
} catch (e) {
  console.warn('[Server] ⚠ Products routes not available:', e.message);
}

try {
  const salesRoutes = require('./server/routes/sales.routes');
  app.use('/api/sales', salesRoutes);
  console.log('[Server] ✓ Sales routes loaded');
} catch (e) {
  console.warn('[Server] ⚠ Sales routes not available:', e.message);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    timestamp: new Date().toISOString()
  });
});

// Helper to find existing binary path
function findExePath(filename) {
  const candidatePaths = [
    path.join(__dirname, filename),
    path.join(__dirname, 'dist', filename),
    path.join(__dirname, 'web', filename),
    path.join(process.cwd(), filename),
    path.join(process.cwd(), 'dist', filename)
  ];
  return candidatePaths.find(p => fs.existsSync(p));
}

// Windows Executable Download Endpoints (32-bit, 64-bit, and Universal Default)
app.get(['/download/32bit', '/download/x86', '/download/PoketStar-POS-32bit.exe', '/api/download/32bit'], (req, res) => {
  const exePath = findExePath('PoketStar-POS-32bit.exe') || findExePath('PoketStar-POS.exe');
  if (exePath) {
    res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
    return res.download(exePath, 'PoketStar-POS-32bit.exe');
  }
  res.status(404).json({ error: '32-bit executable not found. Please run build:exe.' });
});

app.get(['/download/64bit', '/download/x64', '/download/PoketStar-POS-64bit.exe', '/api/download/64bit'], (req, res) => {
  const exePath = findExePath('PoketStar-POS-64bit.exe') || findExePath('PoketStar-POS.exe');
  if (exePath) {
    res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
    return res.download(exePath, 'PoketStar-POS-64bit.exe');
  }
  res.status(404).json({ error: '64-bit executable not found. Please run build:exe.' });
});

app.get(['/download/exe', '/download/PoketStar-POS.exe', '/api/download/exe'], (req, res) => {
  const exePath = findExePath('PoketStar-POS.exe') || findExePath('PoketStar-POS-32bit.exe') || findExePath('PoketStar-POS-64bit.exe');
  if (exePath) {
    res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
    return res.download(exePath, 'PoketStar-POS.exe');
  }
  res.status(404).json({
    error: 'PoketStar-POS.exe binary not found on server.',
    hint: 'Please run npm run build:exe to generate the Windows executable.'
  });
});

// Portable ZIP Package Download Endpoints
app.get(['/download/zip', '/download/portable', '/download/PoketStar-POS-Portable.zip', '/api/download/zip'], (req, res) => {
  const zipPath = findExePath('PoketStar-POS-Portable.zip');
  if (zipPath) {
    res.setHeader('Content-Type', 'application/zip');
    return res.download(zipPath, 'PoketStar-POS-Portable.zip');
  }
  res.status(404).json({ error: 'Portable ZIP package not found. Please run build:exe.' });
});

// Binary Information Endpoint
app.get('/api/download/info', (req, res) => {
  const p32 = findExePath('PoketStar-POS-32bit.exe');
  const p64 = findExePath('PoketStar-POS-64bit.exe');
  const pUni = findExePath('PoketStar-POS.exe');
  const pZip = findExePath('PoketStar-POS-Portable.zip');

  const stat32 = p32 ? fs.statSync(p32) : null;
  const stat64 = p64 ? fs.statSync(p64) : null;
  const statUni = pUni ? fs.statSync(pUni) : null;
  const statZip = pZip ? fs.statSync(pZip) : null;

  res.json({
    available: Boolean(stat32 || stat64 || statUni || statZip),
    universal: {
      filename: 'PoketStar-POS.exe',
      available: Boolean(statUni),
      sizeMB: statUni ? `${(statUni.size / (1024 * 1024)).toFixed(2)} MB` : null,
      downloadUrl: '/download/PoketStar-POS.exe'
    },
    x86_32bit: {
      filename: 'PoketStar-POS-32bit.exe',
      available: Boolean(stat32),
      sizeMB: stat32 ? `${(stat32.size / (1024 * 1024)).toFixed(2)} MB` : null,
      downloadUrl: '/download/PoketStar-POS-32bit.exe',
      arch: 'Windows 32-bit (x86 / IA-32) — Universal compatibility'
    },
    x64_64bit: {
      filename: 'PoketStar-POS-64bit.exe',
      available: Boolean(stat64),
      sizeMB: stat64 ? `${(stat64.size / (1024 * 1024)).toFixed(2)} MB` : null,
      downloadUrl: '/download/PoketStar-POS-64bit.exe',
      arch: 'Windows 64-bit (x64)'
    },
    portableZip: {
      filename: 'PoketStar-POS-Portable.zip',
      available: Boolean(statZip),
      sizeMB: statZip ? `${(statZip.size / (1024 * 1024)).toFixed(2)} MB` : null,
      downloadUrl: '/download/PoketStar-POS-Portable.zip',
      desc: 'Complete Windows Portable Suite (Executables + Batch Launcher + Offline HTML + Catalog)'
    }
  });
});

// Fast instant delivery of root HTML
app.get('/', (req, res) => {
  const html = getIndexHtml();
  if (html) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=120');
    return res.send(html);
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;

// Start server on 0.0.0.0:3000 if executed directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════╗`);
    console.log(`║  Poketstar POS Server Running    ║`);
    console.log(`╚══════════════════════════════════╝`);
    console.log(`
🚀 Listening on http://0.0.0.0:${PORT}
`);
  });
}

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

// Disable X-Powered-By to prevent server fingerprinting
app.disable('x-powered-by');

// Import Cyber Security Middleware
let securityModule;
try {
  securityModule = require('./server/middleware/security');
} catch (e) {
  console.warn('[Server] [WARN] Security module loading note:', e.message);
}

// Apply HTTP Security Headers (MIME-sniffing, XSS filtering, HSTS, Referrer Policy)
if (securityModule && securityModule.securityHeadersMiddleware) {
  app.use(securityModule.securityHeadersMiddleware);
}

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
let cookieParser;
try {
  cookieParser = require('cookie-parser');
} catch (e) {}

if (cookieParser) {
  app.use(cookieParser());
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS & Cookie Credentials Middleware (Allows cross-site printing cookies in iframes and standalone windows with secure preflight)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  const origin = req.headers.origin;
  if (origin) {
    // Validate that origin is a valid HTTP/HTTPS or localhost URI
    if (/^https?:\/\/[a-zA-Z0-9\-\.:_]+$/.test(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Apply API Rate Limiting to prevent denial-of-service and brute force
if (securityModule && securityModule.apiLimiter) {
  app.use('/api', securityModule.apiLimiter);
}

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

// Explicit un-cached route for Service Worker so clients immediately get updates
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'sw.js'));
});

// Fast instant delivery of root HTML with no-cache headers
app.get(['/', '/index.html'], (req, res) => {
  const html = getIndexHtml();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (html) {
    return res.send(html);
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve static assets with caching headers (excluding HTML and SW)
app.use(express.static(path.join(__dirname), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));
app.use('/web', express.static(path.join(__dirname, 'web'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// Mount API routes with error handling
try {
  const authRoutes = require('./server/routes/auth.routes');
  app.use('/api/auth', authRoutes);
  console.log('[Server] [OK] Auth routes loaded');
} catch (e) {
  console.warn('[Server] [WARN] Auth routes not available:', e.message);
}

try {
  const paymentsRoutes = require('./server/routes/payments.routes');
  app.use('/api/payments', paymentsRoutes);
  console.log('[Server] [OK] Payments routes loaded');
} catch (e) {
  console.warn('[Server] [WARN] Payments routes not available:', e.message);
}

try {
  const productsRoutes = require('./server/routes/products.routes');
  app.use('/api/products', productsRoutes);
  console.log('[Server] [OK] Products routes loaded');
} catch (e) {
  console.warn('[Server] [WARN] Products routes not available:', e.message);
}

try {
  const salesRoutes = require('./server/routes/sales.routes');
  app.use('/api/sales', salesRoutes);
  console.log('[Server] [OK] Sales routes loaded');
} catch (e) {
  console.warn('[Server] [WARN] Sales routes not available:', e.message);
}

try {
  const usersRoutes = require('./server/routes/users.routes');
  app.use('/api/users', usersRoutes);
  console.log('[Server] [OK] Users registry routes loaded');
} catch (e) {
  console.warn('[Server] [WARN] Users routes not available:', e.message);
}

try {
  const printerRoutes = require('./server/routes/printer.routes');
  app.use('/api/printer', printerRoutes);
  app.use('/receipts', express.static(path.join(__dirname, 'receipts')));
  app.get(['/print-slip', '/receipt-view'], (req, res) => {
    res.redirect('/api/printer/view' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''));
  });
  console.log('[Server] [OK] Thermal printer routes loaded');
} catch (e) {
  console.warn('[Server] [WARN] Printer routes not available:', e.message);
}

try {
  const securityRoutes = require('./server/routes/security.routes');
  app.use('/api/security', securityRoutes);
  console.log('[Server] [OK] Cyber security & audit routes loaded');
} catch (e) {
  console.warn('[Server] [WARN] Security routes not available:', e.message);
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
[Server] Listening on http://0.0.0.0:${PORT}
`);
  });
}

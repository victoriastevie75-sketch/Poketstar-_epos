#!/usr/bin/env node
/**
 * Poketstar POS Server
 * Unified Express server for serving the POS desktop environment & web demo APIs
 * System Region: East Africa (EAT / UTC+3 — Africa/Nairobi)
 */

process.env.TZ = process.env.TZ || 'Africa/Nairobi';

const express = require('express');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
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

// Middleware: Native zero-dependency cookie parser
app.use((req, res, next) => {
  req.cookies = {};
  const rawCookies = req.headers.cookie;
  if (rawCookies) {
    rawCookies.split(';').forEach(pair => {
      const idx = pair.indexOf('=');
      if (idx > 0) {
        const key = pair.substring(0, idx).trim();
        const val = pair.substring(idx + 1).trim();
        try {
          req.cookies[key] = decodeURIComponent(val);
        } catch (e) {
          req.cookies[key] = val;
        }
      }
    });
  }
  next();
});

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

// Multi-Tenant / Multi-Organization Scoping Middleware
try {
  const tenantMiddleware = require('./server/middleware/tenant.middleware');
  app.use('/api', tenantMiddleware);
} catch (e) {
  console.warn('[Server] [WARN] Tenant middleware note:', e.message);
}

// Fast In-Memory Cache for index.html (with pre-compressed Gzip & ETag)
let cachedIndexHtml = null;
let cachedIndexGzip = null;
let cachedIndexMtime = null;
let cachedIndexEtag = null;

function getIndexHtml() {
  const indexPath = path.join(__dirname, 'index.html');
  try {
    const stats = fs.statSync(indexPath);
    if (!cachedIndexHtml || cachedIndexMtime !== stats.mtimeMs) {
      cachedIndexHtml = fs.readFileSync(indexPath, 'utf8');
      cachedIndexMtime = stats.mtimeMs;
      cachedIndexEtag = `W/"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
      try {
        cachedIndexGzip = zlib.gzipSync(Buffer.from(cachedIndexHtml, 'utf8'), { level: 6 });
      } catch (e) {
        cachedIndexGzip = null;
      }
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

// Fast instant delivery of root HTML with ETag & pre-compressed Gzip buffer
app.get(['/', '/index.html'], (req, res) => {
  const html = getIndexHtml();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  if (cachedIndexEtag) {
    res.setHeader('ETag', cachedIndexEtag);
    if (req.headers['if-none-match'] === cachedIndexEtag) {
      return res.status(304).end();
    }
  }
  if (html) {
    const acceptEnc = req.headers['accept-encoding'] || '';
    if (cachedIndexGzip && acceptEnc.includes('gzip')) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      return res.end(cachedIndexGzip);
    }
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
  const orgsRoutes = require('./server/routes/orgs.routes');
  app.use('/api/orgs', orgsRoutes);
  app.use('/api/organizations', orgsRoutes);
  console.log('[Server] [OK] Multi-Tenant Organizations routes loaded');
} catch (e) {
  console.warn('[Server] [WARN] Organizations routes not available:', e.message);
}

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
    region: 'East Africa',
    timezone: 'Africa/Nairobi (EAT / UTC+3)',
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

// ===== LIVE SYSTEM-TO-EXE SYNCHRONIZATION ENGINE =====
let syncExeModule = null;
try {
  syncExeModule = require('./scripts/sync-exe');
} catch (e) {
  console.warn('[Server] [WARN] EXE sync module note:', e.message);
}

let isSyncingExe = false;
let lastExeSyncResult = null;
const trackedMtimes = new Map();

function recordTrackedMtimes() {
  const trackedFiles = ['index.html', 'products.json', 'users.json', 'sales.json'];
  for (const f of trackedFiles) {
    const fp = path.join(__dirname, f);
    if (fs.existsSync(fp)) {
      try {
        trackedMtimes.set(f, fs.statSync(fp).mtimeMs);
      } catch (e) {}
    }
  }
}

function runExeSyncNow(payload = null, options = {}) {
  if (!syncExeModule || isSyncingExe) return lastExeSyncResult;
  isSyncingExe = true;
  try {
    lastExeSyncResult = syncExeModule.syncSystemToExeFiles(payload, options);
    cachedIndexHtml = null;
    cachedIndexMtime = null;
    getIndexHtml();
    recordTrackedMtimes();
    return lastExeSyncResult;
  } catch (err) {
    console.warn('[Server] [WARN] EXE sync error:', err.message);
    return null;
  } finally {
    isSyncingExe = false;
  }
}

function ensureExeFilesUpToDate(includeZip = false) {
  if (!syncExeModule || isSyncingExe) return;
  try {
    const exe32 = path.join(__dirname, 'PoketStar-POS-32bit.exe');
    const exeMtime = fs.existsSync(exe32) ? fs.statSync(exe32).mtimeMs : 0;
    const trackedFiles = ['index.html', 'products.json', 'users.json', 'sales.json'];
    let needsSync = !exeMtime;
    for (const f of trackedFiles) {
      const fp = path.join(__dirname, f);
      if (fs.existsSync(fp)) {
        const st = fs.statSync(fp);
        if (st.mtimeMs > exeMtime + 50 || (trackedMtimes.has(f) && st.mtimeMs !== trackedMtimes.get(f))) {
          needsSync = true;
          break;
        }
      }
    }
    if (needsSync || includeZip) {
      runExeSyncNow(null, { updateZip: includeZip, silent: false });
    }
  } catch (e) {}
}

// Record initial mtimes without blocking server boot
recordTrackedMtimes();
let lastSyncFinishedAt = 0;

// Live API endpoint to save all system changes directly into the .exe binaries
app.post('/api/system/sync-exe', (req, res) => {
  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  const includeZip = Boolean(payload.updateZip);
  const result = runExeSyncNow(payload, { updateZip: includeZip, silent: true });
  lastSyncFinishedAt = Date.now();
  if (result) {
    return res.json(result);
  }
  res.status(500).json({ status: 'error', message: 'Could not synchronize changes to EXE files.' });
});

app.get('/api/system/sync-status', (req, res) => {
  res.json(lastExeSyncResult || { status: 'ok', updatedAt: new Date().toISOString() });
});

// Windows Executable Download Endpoints (32-bit, 64-bit, and Universal Default)
app.get(['/download/32bit', '/download/x86', '/download/PoketStar-POS-32bit.exe', '/api/download/32bit'], (req, res) => {
  ensureExeFilesUpToDate(false);
  const exePath = findExePath('PoketStar-POS-32bit.exe') || findExePath('PoketStar-POS.exe');
  if (exePath) {
    res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    return res.download(exePath, 'PoketStar-POS-32bit.exe');
  }
  res.status(404).json({ error: '32-bit executable not found. Please run build:exe.' });
});

app.get(['/download/64bit', '/download/x64', '/download/PoketStar-POS-64bit.exe', '/api/download/64bit'], (req, res) => {
  ensureExeFilesUpToDate(false);
  const exePath = findExePath('PoketStar-POS-64bit.exe') || findExePath('PoketStar-POS.exe');
  if (exePath) {
    res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    return res.download(exePath, 'PoketStar-POS-64bit.exe');
  }
  res.status(404).json({ error: '64-bit executable not found. Please run build:exe.' });
});

app.get(['/download/exe', '/download/PoketStar-POS.exe', '/api/download/exe'], (req, res) => {
  ensureExeFilesUpToDate(false);
  const exePath = findExePath('PoketStar-POS.exe') || findExePath('PoketStar-POS-32bit.exe') || findExePath('PoketStar-POS-64bit.exe');
  if (exePath) {
    res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    return res.download(exePath, 'PoketStar-POS.exe');
  }
  res.status(404).json({
    error: 'PoketStar-POS.exe binary not found on server.',
    hint: 'Please run npm run build:exe to generate the Windows executable.'
  });
});

// Portable ZIP Package Download Endpoints
app.get(['/download/zip', '/download/portable', '/download/PoketStar-POS-Portable.zip', '/api/download/zip'], (req, res) => {
  ensureExeFilesUpToDate(true);
  const zipPath = findExePath('PoketStar-POS-Portable.zip');
  if (zipPath) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
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
    lastSyncedAt: lastExeSyncResult ? lastExeSyncResult.updatedAt : new Date().toISOString(),
    universal: {
      filename: 'PoketStar-POS.exe',
      available: Boolean(statUni),
      sizeMB: statUni ? `${(statUni.size / (1024 * 1024)).toFixed(2)} MB` : null,
      mtime: statUni ? statUni.mtime.toISOString() : null,
      downloadUrl: '/download/PoketStar-POS.exe'
    },
    x86_32bit: {
      filename: 'PoketStar-POS-32bit.exe',
      available: Boolean(stat32),
      sizeMB: stat32 ? `${(stat32.size / (1024 * 1024)).toFixed(2)} MB` : null,
      mtime: stat32 ? stat32.mtime.toISOString() : null,
      downloadUrl: '/download/PoketStar-POS-32bit.exe',
      arch: 'Windows 32-bit (x86 / IA-32) — Universal compatibility'
    },
    x64_64bit: {
      filename: 'PoketStar-POS-64bit.exe',
      available: Boolean(stat64),
      sizeMB: stat64 ? `${(stat64.size / (1024 * 1024)).toFixed(2)} MB` : null,
      mtime: stat64 ? stat64.mtime.toISOString() : null,
      downloadUrl: '/download/PoketStar-POS-64bit.exe',
      arch: 'Windows 64-bit (x64)'
    },
    portableZip: {
      filename: 'PoketStar-POS-Portable.zip',
      available: Boolean(statZip),
      sizeMB: statZip ? `${(statZip.size / (1024 * 1024)).toFixed(2)} MB` : null,
      mtime: statZip ? statZip.mtime.toISOString() : null,
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

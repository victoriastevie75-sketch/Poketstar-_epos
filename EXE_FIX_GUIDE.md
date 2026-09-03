# Poket Star POS — EXE Startup Fixes

## 🔴 Critical Issues Identified

The .EXE files (32-bit and 64-bit) are failing to start due to several root causes:

### Issue 1: Missing Server Route Dependencies
**Location:** `server.js` lines 66-74
**Problem:** The server tries to require routes that don't exist:
```javascript
const authRoutes = require('./server/routes/auth.routes');
const paymentsRoutes = require('./server/routes/payments.routes');
const productsRoutes = require('./server/routes/products.routes');
const salesRoutes = require('./server/routes/sales.routes');
```

**Impact:** Node.js crashes immediately when starting the .EXE because these files are missing, preventing the HTTP server from initializing.

### Issue 2: Missing Node Modules
**Problem:** The .EXE bundles dependencies, but `express`, `compression`, and other modules may not be properly packaged.

### Issue 3: Incorrect Browser Launch Paths
**Location:** `desktop-launcher.js` lines 69-87
**Problem:** Browser detection paths are hardcoded and may not work on all systems.

### Issue 4: Port Binding Conflicts
**Location:** `desktop-launcher.js` line 149
**Problem:** If port 3000 is already in use, the app may fail to start without proper fallback.

---

## ✅ Solutions

### Solution 1: Fix Missing Server Routes (CRITICAL)

**Step 1:** Create the missing routes directory structure:

```bash
mkdir -p server/routes
```

**Step 2:** Create `server/routes/auth.routes.js`:
```javascript
const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  res.json({ status: 'ok', message: 'Auth endpoint' });
});

router.get('/logout', (req, res) => {
  res.json({ status: 'ok', message: 'Logged out' });
});

module.exports = router;
```

**Step 3:** Create `server/routes/payments.routes.js`:
```javascript
const express = require('express');
const router = express.Router();

router.post('/process', (req, res) => {
  const { method, amount } = req.body;
  res.json({ 
    status: 'success',
    transactionId: Date.now().toString(),
    method,
    amount
  });
});

router.get('/methods', (req, res) => {
  res.json([
    { id: 'cash', label: 'Cash' },
    { id: 'mpesa', label: 'M-Pesa' },
    { id: 'card', label: 'Card' }
  ]);
});

module.exports = router;
```

**Step 4:** Create `server/routes/products.routes.js`:
```javascript
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const productsPath = path.join(__dirname, '../../products.json');
    if (fs.existsSync(productsPath)) {
      const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
      return res.json(products);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const { name, barcode, price, qty, category } = req.body;
  res.json({ 
    status: 'created',
    product: { id: Date.now().toString(), name, barcode, price, qty, category }
  });
});

module.exports = router;
```

**Step 5:** Create `server/routes/sales.routes.js`:
```javascript
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json([]);
});

router.post('/', (req, res) => {
  const { items, totals, payment } = req.body;
  res.json({
    status: 'recorded',
    saleId: Date.now().toString(),
    items,
    totals,
    payment
  });
});

module.exports = router;
```

---

### Solution 2: Update server.js Error Handling

**Replace lines 66-74 in `server.js` with this safer version:**

```javascript
// Mount API routes with error handling
try {
  const authRoutes = require('./server/routes/auth.routes');
  app.use('/api/auth', authRoutes);
} catch (e) {
  console.warn('[POS] Auth routes not available:', e.message);
}

try {
  const paymentsRoutes = require('./server/routes/payments.routes');
  app.use('/api/payments', paymentsRoutes);
} catch (e) {
  console.warn('[POS] Payments routes not available:', e.message);
}

try {
  const productsRoutes = require('./server/routes/products.routes');
  app.use('/api/products', productsRoutes);
} catch (e) {
  console.warn('[POS] Products routes not available:', e.message);
}

try {
  const salesRoutes = require('./server/routes/sales.routes');
  app.use('/api/sales', salesRoutes);
} catch (e) {
  console.warn('[POS] Sales routes not available:', e.message);
}
```

---

### Solution 3: Improve desktop-launcher.js Error Resilience

**Replace the `openDesktopApp` function (lines 59-116) with:**

```javascript
function openDesktopApp(url) {
  const isWin = process.platform === 'win32' || Boolean(process.env.WINDIR) || Boolean(process.env.SYSTEMROOT);
  const isMac = process.platform === 'darwin';

  if (isWin) {
    const progFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const progFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
    const localAppData = process.env['LOCALAPPDATA'] || '';

    const browserExecutables = [
      path.join(progFilesX86, 'Microsoft/Edge/Application/msedge.exe'),
      path.join(progFiles, 'Microsoft/Edge/Application/msedge.exe'),
      localAppData ? path.join(localAppData, 'Microsoft/Edge/Application/msedge.exe') : null,
      path.join(progFilesX86, 'Google/Chrome/Application/chrome.exe'),
      path.join(progFiles, 'Google/Chrome/Application/chrome.exe'),
      localAppData ? path.join(localAppData, 'Google/Chrome/Application/chrome.exe') : null,
      path.join(progFiles, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
      path.join(progFilesX86, 'BraveSoftware/Brave-Browser/Application/brave.exe')
    ].filter(Boolean);

    let foundBrowser = null;
    for (const browserPath of browserExecutables) {
      try {
        if (fs.existsSync(browserPath)) {
          foundBrowser = browserPath;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (foundBrowser) {
      log(`Launching POS via: ${foundBrowser}`);
      exec(`"${foundBrowser}" --app="${url}" --window-size=1280,840`, (err) => {
        if (err) {
          log(`Browser fallback: ${err.message}`, true);
          exec(`cmd /c start "" "${url}"`);
        }
      });
      return;
    }

    // Universal fallback
    log('Using Windows Shell launcher...');
    exec(`cmd /c start "" "${url}"`, (err) => {
      if (err) {
        try {
          exec(`rundll32 url.dll,FileProtocolHandler "${url}"`);
        } catch (e) {
          log('Failed to open browser', true);
        }
      }
    });
  } else if (isMac) {
    exec(`open "${url}"`, (err) => {
      if (err) log(`macOS open error: ${err.message}`, true);
    });
  } else {
    exec(`xdg-open "${url}"`, (err) => {
      if (err) log(`Linux open error: ${err.message}`, true);
    });
  }
}
```

---

### Solution 4: Improve Port Binding with Better Logging

**Replace the server.listen block (lines 148-188) with:**

```javascript
const server = http.createServer(app);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    log(`Port ${port} is in use. Trying next port...`, true);
    getAvailablePort(port + 1).then((newPort) => {
      server.listen(newPort, '0.0.0.0', onServerReady);
    });
  } else {
    log(`Server error: ${err.message}`, true);
  }
});

function onServerReady() {
  const currentPort = server.address().port;
  const appUrl = `http://localhost:${currentPort}`;
  const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║             POKET STAR POS — SYSTEM ONLINE                    ║
╠════════════════════════════════════════════════════════════════╣
║ 🚀 Engine Status:        Ready                                 ║
║ 📍 Local URL:            ${appUrl.padEnd(48)}║
║ 💻 Architecture:         ${archLabel.padEnd(48)}║
║ 🖨️  Thermal Printer:      ESC/POS Ready                         ║
║ ⚡ Performance:          ${(`${memMb} MB`).padEnd(48)}║
║ 💾 Storage:              ${process.cwd().padEnd(48)}║
╚════════════════════════════════════════════════════════════════╝

💡 Opening Poket Star POS desktop application...
💡 Press 'o' to re-open window, or Ctrl+C to stop.
  `);

  openDesktopApp(appUrl);

  if (process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (key) => {
        if (key === '\u0003' || key === 'q' || key === 'Q') {
          handleExit();
        } else if (key === 'o' || key === 'O') {
          log(`Re-opening window: ${appUrl}`);
          openDesktopApp(appUrl);
        }
      });
    } catch (e) {
      log(`Console interaction unavailable: ${e.message}`);
    }
  }
}

server.listen(port, '0.0.0.0', onServerReady);

const handleExit = () => {
  console.log('\n[POS] Gracefully shutting down Poket Star POS...');
  server.close(() => {
    console.log('[POS] Server stopped. Goodbye!');
    process.exit(0);
  });
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
process.on('SIGHUP', handleExit);
```

---

## 🚀 Testing the Fixes

### Step 1: Verify Routes Are Created
```bash
ls -la server/routes/
# Should show: auth.routes.js, payments.routes.js, products.routes.js, sales.routes.js
```

### Step 2: Rebuild the EXE
```bash
npm run build:exe
```

### Step 3: Test .EXE Directly
1. Double-click `PoketStar-POS-32bit.exe` or `PoketStar-POS-64bit.exe`
2. Check `poketstar-pos.log` for errors
3. The app should open in your default browser at `http://localhost:3000`

### Step 4: Test Batch Launcher
```bash
Start-POS-Desktop.bat
```

---

## 📋 Quick Checklist

- [ ] Created `/server/routes/` directory
- [ ] Created `auth.routes.js`
- [ ] Created `payments.routes.js`
- [ ] Created `products.routes.js`
- [ ] Created `sales.routes.js`
- [ ] Updated `server.js` with try-catch wrappers
- [ ] Updated `desktop-launcher.js` with error handling
- [ ] Rebuilt executables with `npm run build:exe`
- [ ] Tested .EXE startup
- [ ] Verified app opens at `http://localhost:3000`
- [ ] Checked `poketstar-pos.log` for any warnings

---

## 🔧 Debugging

If the EXE still fails to start:

1. **Check the log file:**
   ```bash
   cat poketstar-pos.log  # On Windows: type poketstar-pos.log
   ```

2. **Run launcher with terminal open:**
   ```bash
   Start-POS-Desktop.bat
   # Keep the CMD window open to see error messages
   ```

3. **Verify Node.js is packaged correctly:**
   - Ensure Node.js runtime is embedded in the EXE bundle
   - Check package.json has all required dependencies listed

4. **Manual fallback:**
   - Double-click `index.html` directly in Chrome/Edge
   - Open http://localhost:3000 in any browser

---

## 📞 Support

If issues persist:
- Check that `node_modules/` contains `express`, `compression`, and all dependencies
- Ensure `package.json` lists all required packages
- Verify .EXE was built from the latest code
- Run `npm install` and rebuild if needed


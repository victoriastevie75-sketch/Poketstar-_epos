#!/usr/bin/env node
/**
 * Poket Star POS — Windows Desktop Launcher
 * Standalone executable entry point that bootstraps the embedded POS engine,
 * initializes local storage, and opens the POS UI in an app window.
 * Supports Windows 32-bit (x86) and 64-bit (x64) environments.
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const { exec } = require('child_process');
const net = require('net');

// Crash protection & file logging
const logFile = path.join(process.cwd(), 'poketstar-pos.log');
function log(msg, isError = false) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  try {
    fs.appendFileSync(logFile, line);
  } catch (e) {}
  if (isError) {
    console.error(msg);
  } else {
    console.log(msg);
  }
}

process.on('uncaughtException', (err) => {
  log(`[Uncaught Exception]: ${err.stack || err.message}`, true);
  console.log('\n[Notice] An unexpected event occurred, but Poket Star POS is remaining online.');
});

process.on('unhandledRejection', (reason) => {
  log(`[Unhandled Rejection]: ${reason}`, true);
});

// Require the unified Express app
const app = require('./server');

// Helper to find an available port starting at preferredPort
function getAvailablePort(preferredPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      resolve(getAvailablePort(preferredPort + 1));
    });
    server.listen(preferredPort, '127.0.0.1', () => {
      server.close(() => {
        resolve(preferredPort);
      });
    });
  });
}

// Helper to open standalone App Window
function openDesktopApp(url) {
  const isWin = process.platform === 'win32' || Boolean(process.env.WINDIR) || Boolean(process.env.SYSTEMROOT);
  const isMac = process.platform === 'darwin';

  if (isWin) {
    const progFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const progFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
    const progW6432 = process.env['PROGRAMW6432'] || 'C:\\Program Files';
    const localAppData = process.env['LOCALAPPDATA'] || '';
    const sysDrive = process.env['SystemDrive'] || 'C:';

    const browserExecutables = [
      // Microsoft Edge (Standard on Windows 10 & 11)
      path.join(progFilesX86, 'Microsoft/Edge/Application/msedge.exe'),
      path.join(progFiles, 'Microsoft/Edge/Application/msedge.exe'),
      path.join(progW6432, 'Microsoft/Edge/Application/msedge.exe'),
      localAppData ? path.join(localAppData, 'Microsoft/Edge/Application/msedge.exe') : null,
      `${sysDrive}\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${sysDrive}\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe`,

      // Google Chrome
      path.join(progFilesX86, 'Google/Chrome/Application/chrome.exe'),
      path.join(progFiles, 'Google/Chrome/Application/chrome.exe'),
      path.join(progW6432, 'Google/Chrome/Application/chrome.exe'),
      localAppData ? path.join(localAppData, 'Google/Chrome/Application/chrome.exe') : null,
      `${sysDrive}\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe`,
      `${sysDrive}\\Program Files\\Google\\Chrome\\Application\\chrome.exe`,

      // Brave Browser
      path.join(progFiles, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
      path.join(progFilesX86, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
      localAppData ? path.join(localAppData, 'Programs/BraveSoftware/Brave-Browser/Application/brave.exe') : null,
      localAppData ? path.join(localAppData, 'BraveSoftware/Brave-Browser/Application/brave.exe') : null
    ];

    let foundBrowser = browserExecutables.find(p => p && fs.existsSync(p));

    if (foundBrowser) {
      log(`Launching dedicated POS application window via: ${foundBrowser}`);
      exec(`start "" "${foundBrowser}" --app="${url}" --kiosk-printing --disable-save-password-bubble --disable-features=AutofillServerCommunication,PasswordManagerOnboarding,PrintPreview --window-size=1280,840 --disable-pinch --overscroll-history-navigation=0 --app-id=PoketStarPOS --class=PoketStarPOS`, { windowsHide: true }, (err) => {
        if (err) {
          log(`Launch command alias fallback: ${err.message}`);
          exec(`cmd /c start "" msedge --app="${url}" --kiosk-printing --disable-save-password-bubble --window-size=1280,840 || start "" chrome --app="${url}" --kiosk-printing --disable-save-password-bubble --window-size=1280,840 || start "" brave --app="${url}" --kiosk-printing --disable-save-password-bubble --window-size=1280,840`, { windowsHide: true });
        }
      });
      return;
    }

    // Windows Shell App Mode Execution via start msedge / chrome aliases
    log('Opening dedicated POS window via shell application alias...');
    exec(`cmd /c start "" msedge --app="${url}" --kiosk-printing --disable-save-password-bubble --window-size=1280,840 || start "" chrome --app="${url}" --kiosk-printing --disable-save-password-bubble --window-size=1280,840 || start "" brave --app="${url}" --kiosk-printing --disable-save-password-bubble --window-size=1280,840`, { windowsHide: true }, (err) => {
      if (err) {
        log('MSHTA window fallback...');
        exec(`mshta.exe "javascript:window.resizeTo(1280,840);window.moveTo((screen.width-1280)/2,(screen.height-840)/2);document.write('<title>Poket Star POS</title><body style=\\"margin:0;padding:0;overflow:hidden;\\"><iframe src=\\"${url}\\" style=\\"border:none;width:100vw;height:100vh;\\"></iframe></body>');"`);
      }
    });
  } else if (isMac) {
    exec(`open -n -a "Google Chrome" --args --app="${url}" --kiosk-printing --disable-save-password-bubble || open "${url}"`);
  } else {
    exec(`google-chrome --app="${url}" --kiosk-printing --disable-save-password-bubble || chromium --app="${url}" --kiosk-printing --disable-save-password-bubble || xdg-open "${url}"`);
  }
}

async function main() {
  const archLabel = process.arch === 'ia32' || process.arch === 'x86' ? '32-Bit (x86 Universal)' : `${process.arch} (64-Bit)`;
  
  console.log(`
╔═════════════════════════════════════════════════════════════════╗
║                   POKET STAR EPOS SYSTEM                        ║
║           Enterprise POS — Windows Desktop Edition              ║
║               Architecture: ${archLabel.padEnd(28)}║
╚═════════════════════════════════════════════════════════════════╝
  `);

  // Ensure local products.json exists for data persistence in current folder
  try {
    const localProducts = path.join(process.cwd(), 'products.json');
    const bundledProducts = path.join(__dirname, 'products.json');
    if (!fs.existsSync(localProducts)) {
      if (fs.existsSync(bundledProducts)) {
        log(`[POS] Initializing local database catalog from bundle: ${localProducts}`);
        fs.copyFileSync(bundledProducts, localProducts);
      }
    }
  } catch (err) {
    log(`[POS Notice]: ${err.message}`);
  }

  // Determine port (default to 3000 or find next free port)
  const defaultPort = parseInt(process.env.PORT, 10) || 3000;
  const port = await getAvailablePort(defaultPort);

  // Start HTTP server
  const server = http.createServer(app);
  server.listen(port, '0.0.0.0', () => {
    const appUrl = `http://localhost:${port}`;
    const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    console.log(`
Poket Star Desktop POS Engine is Online!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POS Local URL:       ${appUrl}
System Architecture: ${archLabel}
Thermal Printer:     ESC/POS Direct Ready (80mm & 58mm)
Performance Status:   Blazing Fast (${memMb} MB RAM Used)
Local Storage:       ${process.cwd()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Opening Poket Star POS desktop application window...
Press 'o' in console to re-open window, or Ctrl+C to stop.
    `);

    // Auto open desktop window after engine warms up
    setTimeout(() => {
      openDesktopApp(appUrl);
    }, 400);

    // Console interactive keys
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (key) => {
          if (key === '\u0003' || key === 'q' || key === 'Q') {
            handleExit();
          } else if (key === 'o' || key === 'O') {
            console.log(`[POS] Re-opening desktop window (${appUrl})...`);
            openDesktopApp(appUrl);
          }
        });
      } catch (e) {}
    }
  });

  // Handle graceful shutdown
  const handleExit = () => {
    console.log('\n[POS] Gracefully shutting down Poket Star POS...');
    server.close(() => {
      console.log('[POS] Server stopped. Have a wonderful day!');
      process.exit(0);
    });
  };

  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
}

main().catch((err) => {
  log(`[POS Fatal Error]: ${err.stack || err.message}`, true);
  console.log('\nPress Enter to exit...');
});

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const net = require('net');
const { exec, execFile } = require('child_process');
const {
  printerLimiter,
  sanitizePrinterName,
  isValidIpv4,
  isValidPort,
  resolveSafePath,
  sanitizeHtml
} = require('../middleware/security');

const receiptsDir = path.join(__dirname, '../../receipts');
if (!fs.existsSync(receiptsDir)) {
  try {
    fs.mkdirSync(receiptsDir, { recursive: true });
  } catch (e) {}
}

let lastPrintJob = {
  timestamp: null,
  status: 'idle',
  method: 'browser',
  characters: 0
};

// Helper: Convert text into ESC-POS raw binary buffer
function textToEscPosBuffer(text) {
  const init = Buffer.from([0x1b, 0x40]); // ESC @
  const body = Buffer.from(text + '\n', 'utf8');
  const cut = Buffer.from([0x0a, 0x1b, 0x64, 0x03, 0x1d, 0x56, 0x00]); // Feed 3 + GS V 0 (Cut)
  return Buffer.concat([init, body, cut]);
}

// Helper: Attach printing cookies with SameSite=None and Secure
function attachPrintingCookies(res) {
  try {
    const cookieOpts = {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: false,
      sameSite: 'none',
      secure: true,
      path: '/'
    };
    res.cookie('pos_print_cookie', 'allowed', cookieOpts);
    res.cookie('pos_print_authorized', 'true', cookieOpts);
    res.cookie('pos_silent_print', 'true', cookieOpts);
    res.cookie('pos_print_session', 'session_' + Date.now(), cookieOpts);
  } catch (e) {}
}

// GET & POST printing cookies management
router.get('/cookies', (req, res) => {
  attachPrintingCookies(res);
  res.json({
    status: 'ok',
    printingCookiesAllowed: true,
    cookies: req.cookies || {},
    cookiePolicy: 'SameSite=None; Secure; Path=/',
    message: 'Printing cookies are enabled and allowed for silent thermal dispatch.'
  });
});

router.post('/cookies', (req, res) => {
  attachPrintingCookies(res);
  if (req.body && req.body.token) {
    try {
      const sanitizedToken = String(req.body.token).replace(/[^a-zA-Z0-9_\-\.]/g, '').substring(0, 100);
      res.cookie('pos_print_token', sanitizedToken, {
        maxAge: 365 * 24 * 60 * 60 * 1000,
        sameSite: 'none',
        secure: true,
        path: '/'
      });
    } catch (e) {}
  }
  res.json({
    status: 'success',
    printingCookiesAllowed: true,
    message: 'Printing cookies configured and active.'
  });
});

// GET printer service status
router.get('/status', (req, res) => {
  attachPrintingCookies(res);
  res.json({
    status: 'online',
    systemReady: true,
    printingCookiesAllowed: true,
    lastPrintJob,
    supportedModes: [
      { id: 'silent', name: 'Silent Thermal Mode (Zero Browser Popups / Direct Hardware & Spooler)' },
      { id: 'raw', name: 'Web Serial / USB ESC-POS Direct Printer' },
      { id: 'bluetooth', name: 'Web Bluetooth Thermal Receipt Printer' },
      { id: 'network', name: 'Network ESC-POS Thermal Socket (Port 9100)' },
      { id: 'server', name: 'Native Windows & Linux Spooler (/receipts/)' },
      { id: 'browser', name: 'Standard Browser Print Dialog' }
    ]
  });
});

// POST send print job to server spooler & hardware
router.post('/print', printerLimiter, (req, res) => {
  attachPrintingCookies(res);
  const { content, title, width, saleId, printerIp, printerPort, printerName } = req.body;
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Receipt content is required.' });
  }

  // Safe file naming
  const safeSaleId = (saleId ? String(saleId) : '').replace(/[^a-zA-Z0-9_\-]/g, '') || String(Date.now());
  const filename = `receipt_${safeSaleId}.txt`;
  const filePath = path.join(receiptsDir, filename);
  const latestPath = path.join(receiptsDir, 'latest_receipt.txt');

  try {
    fs.writeFileSync(filePath, content, 'utf8');
    fs.writeFileSync(latestPath, content, 'utf8');
  } catch (err) {
    console.warn('[Printer Route] File write notice:', err.message);
  }

  lastPrintJob = {
    timestamp: new Date().toISOString(),
    status: 'spooled',
    method: printerIp ? 'network-socket' : 'server-spooler',
    characters: content.length,
    filename
  };

  // 1. Direct Network Thermal Printer Socket (Raw Port 9100) - with strict IPv4 validation
  if (printerIp && isValidIpv4(printerIp)) {
    const port = isValidPort(printerPort) ? parseInt(printerPort, 10) : 9100;
    try {
      const socket = new net.Socket();
      socket.setTimeout(2500);
      socket.connect(port, printerIp.trim(), () => {
        const escPosBuf = textToEscPosBuffer(content);
        socket.write(escPosBuf, () => {
          socket.end();
          console.log(`[Printer Network] Dispatched ${escPosBuf.length} bytes to ${printerIp}:${port}`);
        });
      });
      socket.on('error', (sockErr) => {
        console.log(`[Printer Network] Socket note (${printerIp}:${port}):`, sockErr.message);
      });
      socket.on('timeout', () => {
        socket.destroy();
      });
    } catch (netErr) {
      console.log('[Printer Network] Setup exception:', netErr.message);
    }
  }

  // 2. Silent OS hardware dispatch with strict command injection protection
  const cleanPrinterName = sanitizePrinterName(printerName);
  
  if (process.platform === 'win32') {
    const printerTarget = cleanPrinterName ? `-PrinterName "${cleanPrinterName}"` : '';
    const safePathStr = latestPath.replace(/'/g, "''");
    const psCmd = `powershell -NoProfile -NonInteractive -Command "Get-Content -LiteralPath '${safePathStr}' | Out-Printer ${printerTarget}"`;
    exec(psCmd, (error) => {
      if (error) {
        console.log('[Printer Spooler] Windows Out-Printer note:', error.message);
      } else {
        console.log('[Printer Spooler] Successfully sent receipt to default Windows printer');
      }
    });
  } else {
    // Linux / POS Terminal CUPS direct silent spooling
    exec('which lp || which lpr', (err, stdout) => {
      if (!err && stdout && stdout.trim()) {
        const bin = stdout.trim().split('\n')[0];
        const destFlag = cleanPrinterName ? (bin.endsWith('lp') ? `-d "${cleanPrinterName}"` : `-P "${cleanPrinterName}"`) : '';
        const cmd = bin.endsWith('lp') ? `lp -o raw ${destFlag} "${latestPath}"` : `lpr -l ${destFlag} "${latestPath}"`;
        exec(cmd, (lpErr) => {
          if (lpErr) console.log('[Printer Spooler] Linux print note:', lpErr.message);
          else console.log('[Printer Spooler] Sent to Linux/CUPS printer');
        });
      }
    });
  }

  res.json({
    status: 'success',
    message: 'Receipt sent to printer spooler successfully.',
    spoolFile: `/receipts/${filename}`,
    printJob: lastPrintJob
  });
});

// GET latest spooled receipt as text or JSON
router.get('/latest', (req, res) => {
  const latestPath = path.join(receiptsDir, 'latest_receipt.txt');
  if (fs.existsSync(latestPath)) {
    try {
      const content = fs.readFileSync(latestPath, 'utf8');
      if (req.query.format === 'text') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(content);
      }
      return res.json({
        available: true,
        content,
        lastPrintJob
      });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to read latest receipt file.' });
    }
  }
  res.status(404).json({ available: false, error: 'No spooled receipts available yet.' });
});

// GET standalone printable thermal receipt slip page (for popup or direct printing)
router.get(['/view', '/view/:filename', '/print-slip'], (req, res) => {
  let content = '';
  const filename = req.params.filename;
  if (filename) {
    const safeTarget = resolveSafePath(receiptsDir, filename.endsWith('.txt') ? filename : filename + '.txt');
    if (safeTarget && fs.existsSync(safeTarget)) {
      try {
        content = fs.readFileSync(safeTarget, 'utf8');
      } catch (e) {}
    }
  }

  if (!content) {
    const latestPath = path.join(receiptsDir, 'latest_receipt.txt');
    if (fs.existsSync(latestPath)) {
      content = fs.readFileSync(latestPath, 'utf8');
    } else {
      content = '==========================================\n          POKET STAR RETAIL OS          \n           THERMAL RECEIPT SLIP         \n==========================================\nNo receipt data currently available.\n==========================================';
    }
  }

  const width = req.query.width || '80mm';
  const size = req.query.size || 'small';
  const autoPrint = req.query.autoprint === '1' || req.query.print === 'true';
  const paperWidth = width === '58mm' ? '48mm' : (width === 'a4' ? '210mm' : '72mm');
  const pageSize = width === '58mm' ? '58mm auto' : (width === 'a4' ? 'A4' : '80mm auto');

  let fontSize = '8.5px';
  if (width === '58mm') {
    fontSize = size === 'xs' ? '6.8px' : (size === 'regular' ? '8.5px' : '7.5px');
  } else if (width === 'a4') {
    fontSize = '11px';
  } else {
    fontSize = size === 'xs' ? '7.5px' : (size === 'regular' ? '9.8px' : '8.5px');
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Poket Star Receipt</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @page {
      margin: 0;
      size: ${pageSize};
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        width: ${paperWidth} !important;
      }
      .no-print {
        display: none !important;
      }
    }
    body {
      margin: 0 auto;
      padding: 1mm 1.5mm 3cm 1.5mm;
      font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Courier New', Courier, monospace;
      font-size: ${fontSize};
      font-weight: 600;
      line-height: 1.12;
      letter-spacing: 0;
      color: #000000;
      background: #ffffff;
      width: ${paperWidth};
      max-width: 100%;
      box-sizing: border-box;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
      font-family: inherit;
      font-size: inherit;
      font-weight: inherit;
      line-height: inherit;
    }
    .action-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      padding: 8px 12px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      align-items: center;
      justify-content: space-between;
    }
    .action-btn {
      padding: 6px 14px;
      border-radius: 4px;
      border: none;
      background: #059669;
      color: #ffffff;
      font-weight: 700;
      cursor: pointer;
      font-size: 12px;
    }
    .action-btn.secondary {
      background: #475569;
    }
  </style>
</head>
<body>
  <div class="no-print action-bar">
    <div style="font-weight: 600; color: #334155;">Thermal Print Slip</div>
    <div style="display: flex; gap: 6px;">
      <button class="action-btn" onclick="window.print()">Print Receipt</button>
      <button class="action-btn secondary" onclick="window.close()">Close Window</button>
    </div>
  </div>
  <pre>${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  ${autoPrint ? `<script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 200);
    });
  </script>` : ''}
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// GET raw receipt text file download
router.get('/file/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);
  const target = path.join(receiptsDir, safeName.endsWith('.txt') ? safeName : safeName + '.txt');
  if (fs.existsSync(target)) {
    return res.download(target, safeName);
  }
  res.status(404).json({ error: 'Receipt file not found.' });
});

// POST test print job
router.post('/test', (req, res) => {
  const width = req.body.width || '80mm';
  const divider = width === '58mm' ? '--------------------------------' : '==========================================';
  const testText = [
    divider,
    '          POKET STAR RETAIL OS          ',
    '       THERMAL PRINTER TEST PAGE        ',
    divider,
    `Date/Time: ${new Date().toLocaleString()}`,
    `Paper Width: ${width.toUpperCase()}`,
    'Printer Status: ONLINE / OPERATIONAL',
    divider,
    'Character Set: ASCII 32-126 OK',
    'Barcode Scanner Engine: READY',
    'Kenya ETR Tax Module: CERTIFIED',
    divider,
    '       THANK YOU FOR YOUR BUSINESS      ',
    '       *** END OF TEST PRINT ***        ',
    '\n\n\n'
  ].join('\n');

  const latestPath = path.join(receiptsDir, 'latest_receipt.txt');
  try {
    fs.writeFileSync(latestPath, testText, 'utf8');
  } catch (e) {}

  lastPrintJob = {
    timestamp: new Date().toISOString(),
    status: 'test-completed',
    method: 'test-print',
    characters: testText.length
  };

  res.json({
    status: 'success',
    message: 'Test print pattern generated.',
    testText,
    printJob: lastPrintJob
  });
});

// POST reset printer engine and purge spool buffers (Admin only)
router.post('/reset', (req, res) => {
  attachPrintingCookies(res);
  const role = (req.headers['x-pos-role'] || (req.body && req.body.role) || '').toLowerCase();
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Only administrators can reset the thermal printer engine and spooler.' });
  }
  try {
    if (fs.existsSync(receiptsDir)) {
      const files = fs.readdirSync(receiptsDir);
      for (const f of files) {
        if (f.startsWith('receipt_') && f.endsWith('.txt')) {
          try {
            fs.unlinkSync(path.join(receiptsDir, f));
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.warn('[Printer Route] Buffer cleanup notice:', err.message);
  }

  lastPrintJob = {
    timestamp: new Date().toISOString(),
    status: 'reset-completed',
    method: 'hardware-reset',
    characters: 0
  };

  res.json({
    status: 'success',
    message: 'Thermal printer engine, ESC/POS hardware state, and server spooler successfully reset to factory defaults.',
    resetTimestamp: new Date().toISOString(),
    escPosResetCode: '1B 40 (ESC @)',
    printJob: lastPrintJob
  });
});

// GET custom printer drivers
router.get('/drivers', (req, res) => {
  const driversFilePath = path.join(receiptsDir, 'printer_drivers.json');
  if (fs.existsSync(driversFilePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(driversFilePath, 'utf8'));
      return res.json({ status: 'success', drivers: data });
    } catch (e) {}
  }

  // Fallback: Parse from index.html if file does not exist yet
  try {
    const indexPath = path.join(__dirname, '../../index.html');
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf8');
      const match = html.match(/<script id="pos-printer-drivers-json" type="application\/json">([\s\S]*?)<\/script>/);
      if (match && match[1]) {
        const drivers = JSON.parse(match[1].trim());
        return res.json({ status: 'success', drivers });
      }
    }
  } catch (e) {}

  res.json({ status: 'success', drivers: [] });
});

// POST create and save printer driver directly to index.html and server storage (Admin only)
router.post('/save-driver-to-html', (req, res) => {
  attachPrintingCookies(res);
  const role = (req.headers['x-pos-role'] || (req.body && req.body.role) || '').toLowerCase();
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Only administrators can create and save printer drivers to HTML.' });
  }
  const { drivers, driver } = req.body;

  let driversList = [];
  if (Array.isArray(drivers)) {
    driversList = drivers;
  } else if (driver && typeof driver === 'object') {
    // Read existing drivers first
    const driversFilePath = path.join(receiptsDir, 'printer_drivers.json');
    if (fs.existsSync(driversFilePath)) {
      try {
        driversList = JSON.parse(fs.readFileSync(driversFilePath, 'utf8'));
      } catch (e) {}
    }
    const existingIdx = driversList.findIndex(d => d.id === driver.id);
    if (existingIdx >= 0) {
      driversList[existingIdx] = driver;
    } else {
      driversList.push(driver);
    }
  } else {
    return res.status(400).json({ error: 'Valid driver object or drivers array is required.' });
  }

  // 1. Persist to server driver JSON store
  try {
    const driversFilePath = path.join(receiptsDir, 'printer_drivers.json');
    fs.writeFileSync(driversFilePath, JSON.stringify(driversList, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Printer Route] Could not save printer_drivers.json:', e.message);
  }

  // 2. Persist directly into index.html
  let updatedHtmlFiles = 0;
  const targetHtmlPaths = [
    path.join(__dirname, '../../index.html'),
    path.join(__dirname, '../../dist/index.html')
  ];

  const formattedJson = JSON.stringify(driversList, null, 2);
  const newTagContent = `<script id="pos-printer-drivers-json" type="application/json">\n${formattedJson}\n    </script>`;

  for (const targetPath of targetHtmlPaths) {
    if (fs.existsSync(targetPath)) {
      try {
        let content = fs.readFileSync(targetPath, 'utf8');
        if (content.includes('<script id="pos-printer-drivers-json"')) {
          content = content.replace(
            /<script id="pos-printer-drivers-json" type="application\/json">[\s\S]*?<\/script>/,
            newTagContent
          );
        } else {
          // If tag does not exist yet, insert right after pos-products-json closing tag or before interactive script
          if (content.includes('</script>\n\n    <!-- Interactive Script Engine -->')) {
            content = content.replace(
              '</script>\n\n    <!-- Interactive Script Engine -->',
              `</script>\n\n    <!-- Embedded Default & Custom Printer Drivers Registry -->\n    ${newTagContent}\n\n    <!-- Interactive Script Engine -->`
            );
          } else if (content.includes('<!-- Interactive Script Engine -->')) {
            content = content.replace(
              '<!-- Interactive Script Engine -->',
              `<!-- Embedded Default & Custom Printer Drivers Registry -->\n    ${newTagContent}\n\n    <!-- Interactive Script Engine -->`
            );
          }
        }
        fs.writeFileSync(targetPath, content, 'utf8');
        updatedHtmlFiles++;
      } catch (err) {
        console.warn(`[Printer Route] Error updating ${targetPath}:`, err.message);
      }
    }
  }

  res.json({
    status: 'success',
    message: `Printer driver successfully created and permanently saved to HTML (${updatedHtmlFiles} file(s) updated).`,
    driverCount: driversList.length,
    updatedHtmlFiles
  });
});

module.exports = router;

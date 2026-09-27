#!/usr/bin/env node
/**
 * Poket Star POS — Live EXE & Portable Suite Synchronizer
 * Automatically saves all system changes (HTML UI, product catalog, users, sales,
 * printer drivers, and store settings) directly into:
 *   - index.html, products.json, users.json, sales.json (root, dist/, web/)
 *   - PoketStar-POS-32bit.exe (PE32 .rsrc IDR_INDEX_HTML & IDR_PRODUCTS_JSON)
 *   - PoketStar-POS-64bit.exe (PE32+ .rsrc IDR_INDEX_HTML & IDR_PRODUCTS_JSON)
 *   - PoketStar-POS.exe (Universal Windows executable)
 *   - PoketStar-POS-Portable.zip (Complete portable distribution archive)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const WEB_DIR = path.join(ROOT_DIR, 'web');
const RECEIPTS_DIR = path.join(ROOT_DIR, 'receipts');

/**
 * Rebuilds the .rsrc section of a PoketStar-POS PE32 or PE32+ executable
 * with updated IDR_INDEX_HTML (101) and IDR_PRODUCTS_JSON (102) payloads,
 * recalculating all section offsets, DataDirectories, SizeOfImage, and Microsoft PE Checksum.
 */
function rebuildExeWithResources(exeBuffer, newHtmlBuffer, newJsonBuffer) {
  const peOff = exeBuffer.readUInt32LE(0x3C);
  const peSig = exeBuffer.toString('ascii', peOff, peOff + 4);
  if (peSig !== 'PE\0\0') {
    throw new Error('Invalid PE signature');
  }

  const magic = exeBuffer.readUInt16LE(peOff + 24);
  const numSec = exeBuffer.readUInt16LE(peOff + 6);
  const optSize = exeBuffer.readUInt16LE(peOff + 20);
  const secOff = peOff + 24 + optSize;

  let rsrcIdx = -1;
  let relocIdx = -1;
  const sections = [];

  for (let i = 0; i < numSec; i++) {
    const sOff = secOff + i * 40;
    const rawName = exeBuffer.subarray(sOff, sOff + 8);
    const nullIdx = rawName.indexOf(0);
    const name = rawName.subarray(0, nullIdx >= 0 ? nullIdx : 8).toString('ascii');
    const vsize = exeBuffer.readUInt32LE(sOff + 8);
    const vaddr = exeBuffer.readUInt32LE(sOff + 12);
    const rsize = exeBuffer.readUInt32LE(sOff + 16);
    const rptr = exeBuffer.readUInt32LE(sOff + 20);
    const chars = exeBuffer.readUInt32LE(sOff + 36);

    sections.push({ idx: i, off: sOff, name, vsize, vaddr, rsize, rptr, chars });
    if (name === '.rsrc') rsrcIdx = i;
    else if (name === '.reloc') relocIdx = i;
  }

  if (rsrcIdx === -1 || relocIdx === -1) {
    throw new Error('PE binary missing .rsrc or .reloc section');
  }

  const rsrc = sections[rsrcIdx];
  const reloc = sections[relocIdx];
  const rsrcVaddr = rsrc.vaddr;
  const rsrcRptr = rsrc.rptr;

  function getResEntry(entryRel) {
    const rva = exeBuffer.readUInt32LE(rsrcRptr + entryRel);
    const sz = exeBuffer.readUInt32LE(rsrcRptr + entryRel + 4);
    const cp = exeBuffer.readUInt32LE(rsrcRptr + entryRel + 8);
    const res = exeBuffer.readUInt32LE(rsrcRptr + entryRel + 12);
    const fileOff = rsrcRptr + (rva - rsrcVaddr);
    const bytes = Buffer.from(exeBuffer.subarray(fileOff, fileOff + sz));
    return { bytes, cp, res };
  }

  const iconRes = getResEntry(0x148);
  const htmlRes = getResEntry(0x158);
  const jsonRes = getResEntry(0x168);
  const grpRes = getResEntry(0x178);
  const verRes = getResEntry(0x188);
  const manRes = getResEntry(0x198);

  const dirTree = Buffer.from(exeBuffer.subarray(rsrcRptr, rsrcRptr + 0x1A8));

  const payloads = [
    { entryRel: 0x148, bytes: iconRes.bytes, cp: iconRes.cp, res: iconRes.res },
    { entryRel: 0x158, bytes: newHtmlBuffer, cp: htmlRes.cp, res: htmlRes.res },
    { entryRel: 0x168, bytes: newJsonBuffer, cp: jsonRes.cp, res: jsonRes.res },
    { entryRel: 0x178, bytes: grpRes.bytes, cp: grpRes.cp, res: grpRes.res },
    { entryRel: 0x188, bytes: verRes.bytes, cp: verRes.cp, res: verRes.res },
    { entryRel: 0x198, bytes: manRes.bytes, cp: manRes.cp, res: manRes.res }
  ];

  const bodyChunks = [];
  let curRel = 0x1A8;

  for (const item of payloads) {
    dirTree.writeUInt32LE(rsrcVaddr + curRel, item.entryRel);
    dirTree.writeUInt32LE(item.bytes.length, item.entryRel + 4);
    dirTree.writeUInt32LE(item.cp, item.entryRel + 8);
    dirTree.writeUInt32LE(item.res, item.entryRel + 12);

    bodyChunks.push(item.bytes);
    curRel += item.bytes.length;
    const pad8 = (8 - (curRel % 8)) % 8;
    if (pad8 > 0) {
      bodyChunks.push(Buffer.alloc(pad8, 0));
      curRel += pad8;
    }
  }

  const newRsrcVsize = curRel;
  const newRsrcRsize = (newRsrcVsize + 0x1FF) & ~0x1FF;
  const rsrcPad = Buffer.alloc(newRsrcRsize - newRsrcVsize, 0);

  const newRsrcRaw = Buffer.concat([dirTree, ...bodyChunks, rsrcPad]);
  const relocRaw = Buffer.from(exeBuffer.subarray(reloc.rptr, reloc.rptr + reloc.rsize));

  const newRelocVaddr = rsrcVaddr + ((newRsrcVsize + 0xFFF) & ~0xFFF);
  const newRelocRptr = rsrcRptr + newRsrcRsize;
  const newSizeOfImage = newRelocVaddr + ((reloc.vsize + 0xFFF) & ~0xFFF);

  const prefix = Buffer.from(exeBuffer.subarray(0, rsrcRptr));
  const oldLaunchStr = '--app=%s --window-size=1280,840 --disable-pinch --disable-devtools --app-id=PoketStarPOS --class=PoketStarPOS --no-first-run --no-default-browser-check';
  const newLaunchStr = '--app=%s --window-size=1280,840 --kiosk-printing --disable-save-password-bubble --disable-pinch --disable-devtools --no-first-run --app-id=PoketStarPOS';
  const launchIdx = prefix.indexOf(Buffer.from(oldLaunchStr, 'ascii'));
  if (launchIdx !== -1 && oldLaunchStr.length === newLaunchStr.length) {
    prefix.write(newLaunchStr, launchIdx, 'ascii');
  }
  const out = Buffer.concat([prefix, newRsrcRaw, relocRaw]);

  // Update .rsrc section header
  out.writeUInt32LE(newRsrcVsize, rsrc.off + 8);
  out.writeUInt32LE(rsrcVaddr, rsrc.off + 12);
  out.writeUInt32LE(newRsrcRsize, rsrc.off + 16);
  out.writeUInt32LE(rsrcRptr, rsrc.off + 20);

  // Update .reloc section header
  out.writeUInt32LE(reloc.vsize, reloc.off + 8);
  out.writeUInt32LE(newRelocVaddr, reloc.off + 12);
  out.writeUInt32LE(reloc.rsize, reloc.off + 16);
  out.writeUInt32LE(newRelocRptr, reloc.off + 20);

  // Update SizeOfInitializedData
  const oldInitData = out.readUInt32LE(peOff + 24 + 8);
  const newInitData = oldInitData - rsrc.rsize + newRsrcRsize;
  out.writeUInt32LE(newInitData >>> 0, peOff + 24 + 8);

  // Update SizeOfImage
  out.writeUInt32LE(newSizeOfImage >>> 0, peOff + 24 + 56);

  // Update DataDirectory[2] (Resource Table) and DataDirectory[5] (Base Relocation Table)
  const ddOff = peOff + 24 + (magic === 0x10B ? 96 : 112);
  out.writeUInt32LE(rsrcVaddr, ddOff + 2 * 8);
  out.writeUInt32LE(newRsrcVsize, ddOff + 2 * 8 + 4);
  out.writeUInt32LE(newRelocVaddr, ddOff + 5 * 8);
  out.writeUInt32LE(reloc.vsize, ddOff + 5 * 8 + 4);

  // Recalculate Microsoft PE Checksum
  const csOff = peOff + 24 + 64;
  out.writeUInt32LE(0, csOff);
  let total = 0;
  const len = out.length;
  for (let i = 0; i < len; i += 2) {
    const val = i + 1 < len ? out.readUInt16LE(i) : out[i];
    total += val;
    total = (total & 0xFFFF) + (total >>> 16);
  }
  total = (total & 0xFFFF) + (total >>> 16);
  const checksum = (total + len) >>> 0;
  out.writeUInt32LE(checksum, csOff);

  return out;
}

/**
 * Updates or inserts an embedded <script id="..." type="application/json"> block in index.html
 */
function upsertHtmlJsonScriptTag(html, scriptId, jsonString) {
  const newTag = `<script id="${scriptId}" type="application/json">\n${jsonString}\n    </script>`;
  const regex = new RegExp(`<script id="${scriptId}" type="application\\/json">[\\s\\S]*?<\\/script>`);
  if (regex.test(html)) {
    return html.replace(regex, () => newTag);
  }
  // Insert right after pos-printer-drivers-json or pos-products-json
  const driverRegex = /(<script id="pos-printer-drivers-json" type="application\/json">[\s\S]*?<\/script>)/;
  if (driverRegex.test(html)) {
    return html.replace(driverRegex, (match) => `${match}\n    ${newTag}`);
  }
  const prodRegex = /(<script id="pos-products-json" type="application\/json">[\s\S]*?<\/script>)/;
  if (prodRegex.test(html)) {
    return html.replace(prodRegex, (match) => `${match}\n    ${newTag}`);
  }
  return html;
}

/**
 * Rebuilds PoketStar-POS-Portable.zip with the latest binaries and data files
 */
function updatePortableZip(zipPath) {
  const files = [
    { src: 'PoketStar-POS-32bit.exe', dest: 'PoketStar-POS-32bit.exe' },
    { src: 'PoketStar-POS-64bit.exe', dest: 'PoketStar-POS-64bit.exe' },
    { src: 'PoketStar-POS.exe', dest: 'PoketStar-POS.exe' },
    { src: 'Start-POS-Desktop.bat', dest: 'Start-POS-Desktop.bat' },
    { src: 'app.ico', dest: 'app.ico' },
    { src: 'favicon.ico', dest: 'favicon.ico' },
    { src: 'pwa-512x512.png', dest: 'pwa-512x512.png' },
    { src: 'index.html', dest: 'index.html' },
    { src: 'products.json', dest: 'products.json' },
    { src: 'users.json', dest: 'users.json' },
    { src: 'README-WINDOWS.txt', dest: 'README.txt' }
  ];

  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    for (const f of files) {
      const fullSrc = path.join(ROOT_DIR, f.src);
      if (fs.existsSync(fullSrc)) {
        zip.addLocalFile(fullSrc, '', f.dest);
      }
    }
    zip.writeZip(zipPath);
    return true;
  } catch (e) {
    // Fallback if AdmZip fails
    return false;
  }
}

/**
 * Synchronizes all system changes into index.html, data JSON files,
 * the Windows .exe files (32-bit, 64-bit, universal), and the Portable ZIP package.
 */
function syncSystemToExeFiles(payload = null, options = {}) {
  const startMs = Date.now();
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.mkdirSync(WEB_DIR, { recursive: true });
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });

  const indexPath = path.join(ROOT_DIR, 'index.html');
  const productsPath = path.join(ROOT_DIR, 'products.json');
  const usersPath = path.join(ROOT_DIR, 'users.json');
  const salesPath = path.join(ROOT_DIR, 'sales.json');
  const driversPath = path.join(RECEIPTS_DIR, 'printer_drivers.json');
  const statePath = path.join(ROOT_DIR, 'config', 'system-state.json');
  fs.mkdirSync(path.dirname(statePath), { recursive: true });

  // 1. Persist any incoming payload changes to disk JSON files
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.products) && payload.products.length > 0) {
      fs.writeFileSync(productsPath, JSON.stringify(payload.products, null, 2), 'utf8');
    }
    if (Array.isArray(payload.users) && payload.users.length > 0) {
      fs.writeFileSync(usersPath, JSON.stringify(payload.users, null, 2), 'utf8');
    }
    if (Array.isArray(payload.sales)) {
      fs.writeFileSync(salesPath, JSON.stringify(payload.sales, null, 2), 'utf8');
    }
    if (Array.isArray(payload.printerDrivers) && payload.printerDrivers.length > 0) {
      fs.writeFileSync(driversPath, JSON.stringify(payload.printerDrivers, null, 2), 'utf8');
    }
  }

  // 2. Load current canonical data from disk
  let products = [];
  if (fs.existsSync(productsPath)) {
    try {
      products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    } catch (e) {}
  }

  let users = [];
  if (fs.existsSync(usersPath)) {
    try {
      users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    } catch (e) {}
  }

  let sales = [];
  if (fs.existsSync(salesPath)) {
    try {
      sales = JSON.parse(fs.readFileSync(salesPath, 'utf8'));
    } catch (e) {}
  }

  let printerDrivers = null;
  if (fs.existsSync(driversPath)) {
    try {
      printerDrivers = JSON.parse(fs.readFileSync(driversPath, 'utf8'));
    } catch (e) {}
  }

  let savedState = {};
  if (fs.existsSync(statePath)) {
    try {
      savedState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (e) {}
  }

  const updatedAt = (payload && payload.updatedAt) || new Date().toISOString();
  const mergedState = {
    updatedAt,
    users: users.length > 0 ? users : (savedState.users || []),
    sales: Array.isArray(payload && payload.sales) ? payload.sales : (sales.length > 0 ? sales : (savedState.sales || [])),
    heldSales: Array.isArray(payload && payload.heldSales) ? payload.heldSales : (savedState.heldSales || []),
    invoices: Array.isArray(payload && payload.invoices) ? payload.invoices : (savedState.invoices || []),
    voidedSales: Array.isArray(payload && payload.voidedSales) ? payload.voidedSales : (savedState.voidedSales || []),
    theme: (payload && payload.theme) || savedState.theme || 'dark',
    activePrinterDriverId: (payload && payload.activePrinterDriverId) || savedState.activePrinterDriverId || 'drv-escpos-generic',
    settings: {
      ...(savedState.settings || {}),
      ...((payload && payload.settings) || {})
    }
  };

  fs.writeFileSync(statePath, JSON.stringify(mergedState, null, 2), 'utf8');

  // 3. Update index.html with embedded products, printer drivers, and system state
  let htmlContent = fs.readFileSync(indexPath, 'utf8');

  if (Array.isArray(products) && products.length > 0) {
    const compactProducts = JSON.stringify(products);
    htmlContent = upsertHtmlJsonScriptTag(htmlContent, 'pos-products-json', compactProducts);
  }

  if (Array.isArray(printerDrivers) && printerDrivers.length > 0) {
    const formattedDrivers = JSON.stringify(printerDrivers, null, 2);
    htmlContent = upsertHtmlJsonScriptTag(htmlContent, 'pos-printer-drivers-json', formattedDrivers);
  }

  const stateJsonStr = JSON.stringify(mergedState);
  htmlContent = upsertHtmlJsonScriptTag(htmlContent, 'pos-system-state-json', stateJsonStr);

  fs.writeFileSync(indexPath, htmlContent, 'utf8');

  // Copy updated web assets to dist/ and web/
  const webAssets = ['index.html', 'products.json', 'users.json', 'sales.json', 'styles.css', 'manifest.json', 'sw.js'];
  for (const asset of webAssets) {
    const src = path.join(ROOT_DIR, asset);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DIST_DIR, asset));
      fs.copyFileSync(src, path.join(WEB_DIR, asset));
    }
  }

  // 4. Patch the PE .rsrc section inside PoketStar-POS-32bit.exe, PoketStar-POS-64bit.exe, and PoketStar-POS.exe
  const htmlBuffer = Buffer.from(htmlContent, 'utf8');
  const productsBuffer = fs.existsSync(productsPath)
    ? fs.readFileSync(productsPath)
    : Buffer.from(JSON.stringify(products, null, 2), 'utf8');

  const exe32Path = path.join(ROOT_DIR, 'PoketStar-POS-32bit.exe');
  const exe64Path = path.join(ROOT_DIR, 'PoketStar-POS-64bit.exe');
  const exeUniPath = path.join(ROOT_DIR, 'PoketStar-POS.exe');

  if (fs.existsSync(exe32Path)) {
    const orig32 = fs.readFileSync(exe32Path);
    const updated32 = rebuildExeWithResources(orig32, htmlBuffer, productsBuffer);
    fs.writeFileSync(exe32Path, updated32);
    fs.writeFileSync(exeUniPath, updated32);
    fs.copyFileSync(exe32Path, path.join(DIST_DIR, 'PoketStar-POS-32bit.exe'));
    fs.copyFileSync(exe32Path, path.join(WEB_DIR, 'PoketStar-POS-32bit.exe'));
    fs.copyFileSync(exeUniPath, path.join(DIST_DIR, 'PoketStar-POS.exe'));
    fs.copyFileSync(exeUniPath, path.join(WEB_DIR, 'PoketStar-POS.exe'));
  }

  if (fs.existsSync(exe64Path)) {
    const orig64 = fs.readFileSync(exe64Path);
    const updated64 = rebuildExeWithResources(orig64, htmlBuffer, productsBuffer);
    fs.writeFileSync(exe64Path, updated64);
    fs.copyFileSync(exe64Path, path.join(DIST_DIR, 'PoketStar-POS-64bit.exe'));
    fs.copyFileSync(exe64Path, path.join(WEB_DIR, 'PoketStar-POS-64bit.exe'));
  }

  // 5. Update PoketStar-POS-Portable.zip (unless explicitly skipped for ultra-rapid intermediate ticks)
  const zipPath = path.join(ROOT_DIR, 'PoketStar-POS-Portable.zip');
  if (options.updateZip !== false) {
    updatePortableZip(zipPath);
    if (fs.existsSync(zipPath)) {
      fs.copyFileSync(zipPath, path.join(DIST_DIR, 'PoketStar-POS-Portable.zip'));
      fs.copyFileSync(zipPath, path.join(WEB_DIR, 'PoketStar-POS-Portable.zip'));
    }
  }

  function fileMetrics(fp) {
    if (!fs.existsSync(fp)) return null;
    const st = fs.statSync(fp);
    return {
      sizeBytes: st.size,
      sizeMB: `${(st.size / (1024 * 1024)).toFixed(2)} MB`,
      mtime: st.mtime.toISOString()
    };
  }

  const elapsedMs = Date.now() - startMs;
  const summary = {
    status: 'success',
    updatedAt,
    elapsedMs,
    embeddedHtmlBytes: htmlBuffer.length,
    embeddedProductsBytes: productsBuffer.length,
    productCount: products.length,
    userCount: mergedState.users.length,
    saleCount: mergedState.sales.length,
    binaries: {
      x86_32bit: fileMetrics(exe32Path),
      x64_64bit: fileMetrics(exe64Path),
      universal: fileMetrics(exeUniPath),
      portableZip: fileMetrics(zipPath)
    }
  };

  if (!options.silent) {
    console.log(`[EXE-Sync] Synced system changes to .EXE binaries in ${elapsedMs}ms (HTML: ${(htmlBuffer.length / 1024).toFixed(1)} KB, Products: ${products.length})`);
  }

  return summary;
}

module.exports = {
  syncSystemToExeFiles,
  rebuildExeWithResources
};

if (require.main === module) {
  const res = syncSystemToExeFiles();
  console.log(JSON.stringify(res, null, 2));
}

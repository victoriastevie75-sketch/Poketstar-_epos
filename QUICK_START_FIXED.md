# 🚀 Poket Star POS — Quick Start Guide (FIXED)

## ✅ What Was Fixed

Your EXE files were failing to start due to **missing API route files**. This has been resolved:

✓ Created `server/routes/auth.routes.js` — Authentication endpoints  
✓ Created `server/routes/payments.routes.js` — Payment processing  
✓ Created `server/routes/products.routes.js` — Inventory management  
✓ Created `server/routes/sales.routes.js` — Transaction recording  
✓ Updated `server.js` with error handling for missing dependencies  

---

## 🎯 How to Use the Fixed System

### **Option 1: Direct EXE Launch (Recommended)**

1. **Download & Extract** the files to a folder on your Windows machine
2. **Double-click** either:
   - `PoketStar-POS-64bit.exe` (for modern Windows 10/11)
   - `PoketStar-POS-32bit.exe` (for older Windows or compatibility)
   - `PoketStar-POS.exe` (automatic selection)

3. **Wait 2-3 seconds** for the app to start
4. Your default browser will open to `http://localhost:3000`
5. The POS system is ready to use!

### **Option 2: Smart Batch Launcher**

1. **Double-click** `Start-POS-Desktop.bat`
2. This automatically detects your Windows version (32-bit or 64-bit)
3. Launches the appropriate executable
4. Opens in your default browser

### **Option 3: Direct HTML (No Installation)**

1. **Double-click** `index.html` in Chrome or Microsoft Edge
2. System runs 100% offline with local storage
3. Everything is self-contained—no server required

---

## 🔧 If the EXE Still Doesn't Start

### **Step 1: Check the Log File**

After running the EXE, a log file is created:

```
poketstar-pos.log
```

**Open it and look for errors:**

```bash
# On Windows, use Notepad:
notepad poketstar-pos.log

# Or in PowerShell:
Get-Content poketstar-pos.log
```

**Common issues:**

| Error | Solution |
|-------|----------|
| `Cannot find module './server/routes/auth.routes'` | ✓ Already fixed—re-download latest version |
| `Port 3000 already in use` | Set `PORT=3001` environment variable and retry |
| `Cannot read file index.html` | Ensure `index.html` is in the same folder as the EXE |
| `Node.js not found` | Node.js is bundled—reinstall the EXE or try 32-bit version |

### **Step 2: Test the Health Endpoint**

Open your browser and visit:

```
http://localhost:3000/health
```

You should see a response like:

```json
{
  "status": "ok",
  "uptime": 12.345,
  "memoryMB": 45,
  "timestamp": "2026-09-03T12:00:00.000Z"
}
```

If you see this, the **server is running correctly**.

### **Step 3: Manual Fallback**

If the EXE doesn't open a browser automatically:

1. Open `http://localhost:3000` in Chrome/Edge manually
2. Or double-click `index.html` directly

---

## 📊 API Endpoints (For Developers)

The system now includes full API support:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/login` | POST | User authentication |
| `/api/payments/process` | POST | Process payment |
| `/api/products/` | GET/POST | Manage products |
| `/api/sales/` | GET/POST | Record sales |
| `/health` | GET | Server health check |

**Example: Create a Product**

```bash
curl -X POST http://localhost:3000/api/products/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Coffee",
    "barcode": "SKU001",
    "price": 150,
    "qty": 50,
    "category": "Beverages"
  }'
```

---

## 📁 File Structure

```
Poketstar-_epos/
├── PoketStar-POS-32bit.exe       ✓ 32-bit executable
├── PoketStar-POS-64bit.exe       ✓ 64-bit executable
├── PoketStar-POS.exe             ✓ Universal (auto-selects)
├── Start-POS-Desktop.bat         ✓ Smart launcher
├── index.html                    ✓ Main application
├── products.json                 ✓ Product catalog (1,629 items)
├── server.js                     ✓ Server with error handling
├── desktop-launcher.js           ✓ Desktop app bootstrap
├── server/
│   └── routes/
│       ├── auth.routes.js        ✓ NEW - Authentication
│       ├── payments.routes.js    ✓ NEW - Payments
│       ├── products.routes.js    ✓ NEW - Inventory
│       └── sales.routes.js       ✓ NEW - Sales tracking
└── EXE_FIX_GUIDE.md              ✓ Detailed troubleshooting
```

---

## 🎯 Testing Checklist

After launching, verify:

- [ ] App opens in browser at `http://localhost:3000`
- [ ] Sales floor loads with product search
- [ ] Can add items to cart
- [ ] Payment methods show (Cash, M-Pesa, Card)
- [ ] Receipt prints or shows on screen
- [ ] Keyboard shortcuts work (Ctrl+L to clear cart)
- [ ] Dark mode toggle works (🌙 button)
- [ ] Printer test works (🖨️ button)

---

## 🚨 Emergency: App Crashes on Startup

**If you still have issues:**

1. **Check Windows Defender/Antivirus:**
   - The EXE may be flagged as suspicious (it's a standalone bundle)
   - Click "More info" → "Run anyway" when prompted
   - Add to antivirus exceptions if needed

2. **Verify all files are present:**
   ```bash
   dir /s  # On Windows Command Prompt
   ```
   Should show all 4 route files in `server/routes/`

3. **Try the fallback HTML mode:**
   - Skip the EXE entirely
   - Double-click `index.html` in Chrome
   - Operates in pure browser mode (100% offline)

4. **Rebuild the executables** (if you have Node.js):
   ```bash
   npm install
   npm run build:exe
   ```

---

## 📞 Support Resources

- **Log file**: `poketstar-pos.log` (in the folder where you ran the EXE)
- **Health check**: Visit `http://localhost:3000/health`
- **API info**: Visit `http://localhost:3000/api/download/info`
- **Documentation**: See `EXE_FIX_GUIDE.md` for detailed fixes

---

## 🎉 You're Ready!

Your Poket Star POS system is now fixed and ready to use. Launch it, and start processing transactions smoothly!

**Questions?** Check the logs, run the health check, or use the HTML fallback mode.


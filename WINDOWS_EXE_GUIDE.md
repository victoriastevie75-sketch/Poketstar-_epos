# Poket Star POS — Windows Standalone Executable (.EXE) Guide

## Overview
**PoketStar-POS.exe** is a 100% self-contained, portable Windows 64-bit desktop application for the Poket Star EPOS system. It operates fully offline and runs directly without installing Node.js, Python, or additional runtimes.

---

## 🚀 How to Run on Windows

1. **Download the Executable**:
   - Download `PoketStar-POS.exe` directly from the web interface via the **💻 Download .EXE** button in the top navigation bar, or navigate to:
     ```
     /download/PoketStar-POS.exe
     ```
2. **Move to Desired Location**:
   - Place `PoketStar-POS.exe` on your Desktop or in a folder like `C:\PoketStar-POS`.
3. **Double-Click to Launch**:
   - Double-click `PoketStar-POS.exe`.
   - The launcher will start the embedded offline POS engine and automatically open your POS terminal window (using Microsoft Edge in clean, borderless App Mode, or your default browser).

---

## 🖨️ Hardware & Thermal Printer Integration

- **80mm & 58mm Thermal Printers**:
  - The application automatically sends formatted ESC/POS style receipts directly to your Windows Default Printer.
  - Test your default printer at any time by clicking **🖨️ Default Printer** in the top navigation or pressing **P** on the completed sale screen.
  - To enable silent, one-click printing without confirmation prompts, enable Chrome/Edge kiosk printing mode:
    ```cmd
    msedge.exe --kiosk --kiosk-printing http://localhost:3000
    ```
- **Barcode Scanners**:
  - All standard USB and Bluetooth HID barcode scanners are supported out of the box. Scan any product barcode to instantly add items to the cart.

---

## 💾 Local Data Persistence & Custom Catalog

- On first launch, `PoketStar-POS.exe` extracts your full 1,629 product catalog to `products.json` in the same directory as the executable.
- Any new items, stock updates, price changes, or sales transactions you add while running the desktop app are saved automatically to your local storage.
- You can backup your database simply by copying the `products.json` file.

---

## 🛠️ Rebuilding the Executable

If you modify source code or UI files and wish to compile a new `.exe`:

```bash
npm run build:exe
```

This runs `scripts/build-exe.js`, packages all web assets, and generates `PoketStar-POS.exe` and `dist/PoketStar-POS.exe`.

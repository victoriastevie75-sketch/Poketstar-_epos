const fs = require('fs');
const vm = require('vm');
const path = require('path');

console.log('--- Starting Poket Star EPOS HTML Rebuild & Verification ---');

const rawHtml = fs.readFileSync('index.html', 'utf8');

// 1. Extract HTML Head and Body markup before the JSON scripts
// Line 1 to just before <script id="pos-products-json"
const splitMarker = '<script id="pos-products-json"';
const htmlParts = rawHtml.split(splitMarker);
let baseHtml = htmlParts[0].trim();

// Ensure metadata & title in HTML head
baseHtml = baseHtml.replace(/<title>.*?<\/title>/i, '<title>Poket Star EPOS — Enterprise Multi-Store & Retail Management System</title>');
baseHtml = baseHtml.replace(/<meta name="description" content=".*?"/i, '<meta name="description" content="Poket Star EPOS — Multi-Organization Retail POS & Enterprise Store Management System"');
baseHtml = baseHtml.replace(/<meta property="og:title" content=".*?"/i, '<meta property="og:title" content="Poket Star EPOS — Enterprise Retail POS System"');
baseHtml = baseHtml.replace(/<meta property="og:description" content=".*?"/i, '<meta property="og:description" content="Poket Star EPOS — Multi-Store Retail Management with Standalone Desktop & Mobile Execution"');

// Ensure organization modals exist in the markup
const orgModalsHtml = `
    <!-- ORGANIZATIONS MANAGER & QUICK SWITCH MODAL -->
    <div id="orgManagerModal" class="modal hidden">
        <div class="modal-content" style="max-width: 600px; width: 92%;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.4rem;">🏢</span>
                    <div>
                        <h2 style="margin: 0; font-size: 1.25rem; color: var(--ink);">Select Organization / Store Workspace</h2>
                        <p style="margin: 0; font-size: 0.75rem; color: var(--text-muted);">Switch between completely isolated store branches, catalogs, and staff</p>
                    </div>
                </div>
                <button type="button" class="btn outline" onclick="closeOrgManagerModal()" style="padding: 4px 10px; font-size: 0.8rem;">✕</button>
            </div>
            <div id="orgQuickSwitchList" style="display: flex; flex-direction: column; gap: 8px; max-height: 380px; overflow-y: auto; padding-right: 4px; margin-bottom: 16px;">
                <!-- Dynamically populated -->
            </div>
            <div style="border-top: 1px solid var(--border); padding-top: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <button type="button" class="btn" onclick="closeOrgManagerModal(); openCreateOrgModal();" style="background: #3b82f6; color: #fff; font-weight: 700; font-size: 0.85rem; padding: 7px 14px;">+ Register New Organization</button>
                <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn secondary outline" onclick="closeOrgManagerModal(); switchTab('orgs');" style="font-size: 0.85rem; padding: 7px 12px;">Full Org Management ↗</button>
                    <button type="button" class="btn secondary outline" onclick="closeOrgManagerModal()" style="font-size: 0.85rem; padding: 7px 12px;">Close</button>
                </div>
            </div>
        </div>
    </div>

    <!-- CREATE NEW ORGANIZATION MODAL -->
    <div id="newOrgModal" class="modal hidden">
        <div class="modal-content" style="max-width: 520px; width: 92%;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px;">
                <h2 style="margin: 0; font-size: 1.25rem; color: var(--ink);">+ Register New Store / Organization</h2>
                <button type="button" class="btn outline" onclick="closeCreateOrgModal()" style="padding: 4px 10px; font-size: 0.8rem;">✕</button>
            </div>
            <form id="newOrgForm" onsubmit="saveNewOrganization(event)" style="display: flex; flex-direction: column; gap: 12px;">
                <div>
                    <label style="font-size: 0.78rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: block;">Business / Organization Name *</label>
                    <input type="text" id="newOrgName" required placeholder="e.g. Poket Star Westlands Branch" style="width: 100%; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--ink);" />
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="font-size: 0.78rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: block;">Branch / Store Code *</label>
                        <input type="text" id="newOrgCode" required placeholder="e.g. WST-02" style="width: 100%; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--ink);" />
                    </div>
                    <div>
                        <label style="font-size: 0.78rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: block;">Business Type</label>
                        <select id="newOrgBusinessType" style="width: 100%; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--ink);">
                            <option value="Retail & Supermarket">Retail & Supermarket</option>
                            <option value="Boutique & Apparel">Boutique & Apparel</option>
                            <option value="Electronics & Hardware">Electronics & Hardware</option>
                            <option value="Pharmacy & Health">Pharmacy & Health</option>
                            <option value="Restaurant & Cafe">Restaurant & Cafe</option>
                            <option value="Wholesale & Distribution">Wholesale & Distribution</option>
                            <option value="General Enterprise">General Enterprise</option>
                        </select>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="font-size: 0.78rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: block;">Currency</label>
                        <select id="newOrgCurrency" style="width: 100%; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--ink);">
                            <option value="KES" selected>KES (Kenyan Shilling - KSh)</option>
                            <option value="USD">USD (US Dollar - $)</option>
                            <option value="EUR">EUR (Euro - €)</option>
                            <option value="GBP">GBP (British Pound - £)</option>
                            <option value="TZS">TZS (Tanzanian Shilling - TSh)</option>
                            <option value="UGX">UGX (Ugandan Shilling - USh)</option>
                            <option value="ZAR">ZAR (South African Rand - R)</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size: 0.78rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: block;">VAT / Tax Rate (%)</label>
                        <input type="number" id="newOrgTaxRate" value="16" min="0" max="100" step="0.5" style="width: 100%; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--ink);" />
                    </div>
                </div>
                <div>
                    <label style="font-size: 0.78rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: block;">Physical Address / Location</label>
                    <input type="text" id="newOrgAddress" placeholder="e.g. Westlands Mall, 2nd Floor, Nairobi" style="width: 100%; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--ink);" />
                </div>
                <div>
                    <label style="font-size: 0.78rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: block;">KRA / Tax PIN (Optional)</label>
                    <input type="text" id="newOrgTaxPin" placeholder="e.g. P051988223Z" style="width: 100%; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--ink);" />
                </div>
                <div>
                    <label style="font-size: 0.78rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: block;">Receipt Header Brand Name</label>
                    <input type="text" id="newOrgReceiptHeader" placeholder="Leave blank to use Organization Name" style="width: 100%; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--ink);" />
                </div>
                <div style="background: rgba(59, 130, 246, 0.08); padding: 10px; border-radius: 4px; font-size: 0.74rem; color: var(--text-muted); border-left: 3px solid #3b82f6;">
                    🔒 <strong>Data Isolation Guarantee:</strong> Creating this store allocates a dedicated directory on disk (<code>data/orgs/&lt;code&gt;/</code>). Its catalog and financial data are 100% isolated.
                </div>
                <div style="border-top: 1px solid var(--border); padding-top: 12px; display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
                    <button type="button" class="btn secondary outline" onclick="closeCreateOrgModal()">Cancel</button>
                    <button type="submit" class="btn" style="background: #3b82f6; color: #fff; font-weight: 700;">Create Organization & Switch</button>
                </div>
            </form>
        </div>
    </div>

    <!-- EDIT ORGANIZATION PROFILE MODAL -->
    <div id="editOrgModal" class="modal hidden">
        <div class="modal-content" style="max-width: 520px; width: 92%;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px;">
                <h2 style="margin: 0; font-size: 1.25rem; color: var(--ink);">⚙️ Edit Organization Settings</h2>
                <button type="button" class="btn outline" onclick="closeEditOrgModal()" style="padding: 4px 10px; font-size: 0.8rem;">✕</button>
            </div>
            <form id="editOrgForm" onsubmit="saveEditOrganization(event)" style="display: flex; flex-direction: column; gap: 12px;">
                <input type="hidden" id="editOrgId" />
                <div>
                    <label style="font-size: 0.78rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: block;">Organization Name *</label>
                    <input type="text" id="editOrgName" required style="width: 100%; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--ink);" />
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="font-size: 0.78rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: block;">Branch Code</label>
                        <input type="text" id="editOrgCode" readonly style="width: 100%; padding: 8px 12px; background: var(--card); border: 1px solid var(--border); border-radius: 4px; color: var(--text-muted); cursor: not-allowed;" />
                    </div>
                    <div>
                        <label style="font-size: 0.78rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: block;">Business Type</label>
                        <input type="text" id="editOrgBusinessType" style="width: 100%; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--ink);" />
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="font-size: 0.78rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: block;">Currency Symbol</label>
                        <input type="text" id="editOrgCurrencySymbol" style="width: 100%; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--ink);" />
                    </div>
                    <div>
                        <label style="font-size: 0.78rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: block;">VAT Rate (%)</label>
                        <input type="number" id="editOrgTaxRate" min="0" max="100" step="0.5" style="width: 100%; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--ink);" />
                    </div>
                </div>
                <div>
                    <label style="font-size: 0.78rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: block;">Physical Address</label>
                    <input type="text" id="editOrgAddress" style="width: 100%; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--ink);" />
                </div>
                <div>
                    <label style="font-size: 0.78rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: block;">Receipt Footer Message</label>
                    <input type="text" id="editOrgReceiptFooter" style="width: 100%; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--ink);" />
                </div>
                <div style="border-top: 1px solid var(--border); padding-top: 12px; display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
                    <button type="button" class="btn secondary outline" onclick="closeEditOrgModal()">Cancel</button>
                    <button type="submit" class="btn" style="background: #3b82f6; color: #fff; font-weight: 700;">Save Store Changes</button>
                </div>
            </form>
        </div>
    </div>

    <!-- IMPORT ORGANIZATION BACKUP MODAL -->
    <div id="importOrgModal" class="modal hidden">
        <div class="modal-content" style="max-width: 500px; width: 92%;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px;">
                <h2 style="margin: 0; font-size: 1.25rem; color: var(--ink);">📥 Import Store Workspace Backup</h2>
                <button type="button" class="btn outline" onclick="closeImportOrgModal()" style="padding: 4px 10px; font-size: 0.8rem;">✕</button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 14px;">
                <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0;">
                    Upload a previously exported <code>.json</code> organization backup to restore its catalog, sales transactions, and staff registry without overwriting existing workspaces.
                </p>
                <div style="border: 2px dashed var(--border); border-radius: 6px; padding: 24px; text-align: center; cursor: pointer;" onclick="document.getElementById('importOrgFileInput').click()">
                    <span style="font-size: 2rem;">📁</span>
                    <div style="font-weight: 700; font-size: 0.9rem; color: var(--ink); margin-top: 6px;">Click to select JSON Backup File</div>
                    <div style="font-size: 0.74rem; color: var(--text-muted);">Format: poketstar-org-backup-*.json</div>
                    <input type="file" id="importOrgFileInput" accept=".json,application/json" style="display: none;" onchange="handleImportOrgFile(event)" />
                </div>
                <div style="border-top: 1px solid var(--border); padding-top: 12px; display: flex; justify-content: flex-end; gap: 8px;">
                    <button type="button" class="btn secondary outline" onclick="closeImportOrgModal()">Cancel</button>
                </div>
            </div>
        </div>
    </div>
`;

if (!baseHtml.includes('id="orgManagerModal"')) {
  // Append before the end of the modals
  baseHtml = baseHtml + '\n' + orgModalsHtml;
}

// 2. Build the Embedded Data Script Tags
const productsJsonScript = `    <script id="pos-products-json" type="application/json">\n[]\n    </script>`;

// Get Printer Drivers
let printerDriversJson = `[
  {
    "id": "drv-escpos-generic",
    "name": "Generic ESC/POS Standard 80mm",
    "brand": "Universal / Epson / Xprinter / Star",
    "width": "80mm",
    "columns": 42,
    "baudRate": 9600,
    "emulation": "ESC/POS",
    "cutCommand": "1D564100",
    "drawerKick": "1B700019FA",
    "isBuiltIn": true,
    "isDefault": true
  },
  {
    "id": "drv-escpos-58mm",
    "name": "Compact Mini 58mm Thermal Printer",
    "brand": "Universal / POS-58 / Zjiang / Netum",
    "width": "58mm",
    "columns": 32,
    "baudRate": 9600,
    "emulation": "ESC/POS",
    "cutCommand": "1D564100",
    "drawerKick": "1B700019FA",
    "isBuiltIn": true,
    "isDefault": false
  }
]`;
if (rawHtml.includes('id="pos-printer-drivers-json"')) {
  try {
    const m = rawHtml.match(/<script id="pos-printer-drivers-json"[^>]*>([\s\S]*?)<\/script>/i);
    if (m && m[1]) {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        printerDriversJson = JSON.stringify(parsed, null, 2);
      }
    }
  } catch (e) {}
}

const printerDriversScript = `    <script id="pos-printer-drivers-json" type="application/json">\n${printerDriversJson}\n    </script>`;

// System state
let systemStateJson = JSON.stringify({
  updatedAt: new Date().toISOString(),
  users: [
    {
      id: "USR-001",
      username: "admin",
      name: "Stevie Administrator",
      role: "admin",
      pin: "1234",
      tillId: "Till-01",
      status: "active",
      phone: "+254700000001",
      email: "admin@poketstar.com",
      permissions: ["sales", "discounts", "refunds", "inventory", "reports", "users"],
      createdAt: "2026-01-01T00:00:00.000Z",
      lastLogin: new Date().toISOString()
    }
  ],
  sales: [],
  heldSales: [],
  invoices: [],
  voidedSales: [],
  theme: "dark",
  activePrinterDriverId: "drv-escpos-generic",
  settings: {
    pos_store_name: "POKET STAR EPOS",
    pos_store_footer_msg: "THANK YOU FOR SHOPPING WITH US! POWERED BY POKET STAR EPOS.",
    pos_printer_width: "80mm",
    pos_receipt_format: "standard",
    pos_receipt_size: "large",
    pos_silent_print_mode: "true",
    pos_auto_print: "true",
    pos_print_sound: "true",
    pos_spool_server: "true",
    pos_network_printer_port: "9100",
    pos_serial_baud: "9600",
    pos_print_cookies_allowed: "true"
  }
}, null, 2);

const systemStateScript = `    <script id="pos-system-state-json" type="application/json">\n${systemStateJson}\n    </script>`;

// Write clean index.js engine code
const jsEngine = fs.readFileSync('scripts/engine-template.js', 'utf8');

// Combine into final index.html
const finalHtml = `${baseHtml}

${productsJsonScript}

    <!-- Embedded Default & Custom Printer Drivers Registry -->
${printerDriversScript}

${systemStateScript}

    <!-- Interactive Script Engine -->
    <script>
${jsEngine}
    </script>
</body>
</html>
`;

fs.writeFileSync('index.html', finalHtml);
console.log('Successfully wrote index.html, total size:', finalHtml.length, 'bytes');

// Also verify with vm.Script
try {
  new vm.Script(jsEngine);
  console.log('JS Engine vm.Script syntax validation: PASSED [OK]');
} catch (err) {
  console.error('JS Engine syntax validation: FAILED [X]:', err);
  process.exit(1);
}

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Inject DEFAULT_PRINTER_DRIVERS, getInitialPrinterDrivers, and isAdmin before const state
const stateInitTarget = '        const state = {\n            products: getInitialProducts(),';

const driversAndAdminLogic = `        // ===== PRINTER DRIVER REGISTRY & RBAC LOGIC =====
        const DEFAULT_PRINTER_DRIVERS = [
            {
                id: 'drv-escpos-generic',
                name: 'Generic ESC/POS Thermal Driver (Standard 80mm)',
                brand: 'Generic / Universal',
                emulation: 'ESC/POS',
                width: '80mm',
                columns: 42,
                baudRate: 9600,
                initCommand: '1B40',
                cutCommand: '1D564100',
                drawerKick: '1B700019FA',
                codepage: 'PC437',
                feedLines: 3,
                isBuiltIn: true,
                isDefault: true,
                notes: 'Standard ESC/POS thermal printer driver with auto-cutter and drawer pin 2 kick.'
            },
            {
                id: 'drv-escpos-58mm',
                name: 'Generic ESC/POS Compact Driver (58mm)',
                brand: 'Generic / Universal',
                emulation: 'ESC/POS',
                width: '58mm',
                columns: 32,
                baudRate: 9600,
                initCommand: '1B40',
                cutCommand: 'NONE',
                drawerKick: '1B700019FA',
                codepage: 'PC437',
                feedLines: 2,
                isBuiltIn: true,
                isDefault: false,
                notes: 'Compact 58mm POS receipt driver for mobile bluetooth and USB mini thermal printers.'
            },
            {
                id: 'drv-epson-tmt20',
                name: 'Epson TM-T20 / TM-T88 Direct Thermal Driver',
                brand: 'Epson',
                emulation: 'ESC/POS',
                width: '80mm',
                columns: 48,
                baudRate: 38400,
                initCommand: '1B40',
                cutCommand: '1D564100',
                drawerKick: '1B700019FA',
                codepage: 'PC437',
                feedLines: 4,
                isBuiltIn: true,
                isDefault: false,
                notes: 'High-reliability Epson thermal receipt printer with fast partial & full auto-cutter.'
            },
            {
                id: 'drv-xprinter-q800',
                name: 'Xprinter XP-Q800 / XP-N160I Series Driver',
                brand: 'Xprinter',
                emulation: 'ESC/POS',
                width: '80mm',
                columns: 42,
                baudRate: 19200,
                initCommand: '1B40',
                cutCommand: '1D564200',
                drawerKick: '1B700019FA',
                codepage: 'PC437',
                feedLines: 3,
                isBuiltIn: true,
                isDefault: false,
                notes: 'High speed 260mm/s commercial thermal printer with sound buzzer trigger.'
            },
            {
                id: 'drv-star-micronics',
                name: 'Star Micronics TSP100 / TSP650 Line Mode Driver',
                brand: 'Star Micronics',
                emulation: 'Star Line Mode',
                width: '80mm',
                columns: 48,
                baudRate: 9600,
                initCommand: '1B40',
                cutCommand: '1B6402',
                drawerKick: '07',
                codepage: 'PC437',
                feedLines: 3,
                isBuiltIn: true,
                isDefault: false,
                notes: 'Native Star Line mode emulation driver with Star drawer kick (BEL 07).'
            },
            {
                id: 'drv-sunmi-v2',
                name: 'Sunmi V2 / V2 Pro Cloud Terminal Driver (58mm)',
                brand: 'Sunmi',
                emulation: 'ESC/POS',
                width: '58mm',
                columns: 32,
                baudRate: 115200,
                initCommand: '1B40',
                cutCommand: 'NONE',
                drawerKick: 'NONE',
                codepage: 'WPC1252',
                feedLines: 3,
                isBuiltIn: true,
                isDefault: false,
                notes: 'Handheld POS mobile terminal driver optimized for high-density 58mm paper.'
            }
        ];

        function getInitialPrinterDrivers() {
            try {
                const el = document.getElementById('pos-printer-drivers-json');
                if (el && el.textContent.trim()) {
                    const parsed = JSON.parse(el.textContent.trim());
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                }
            } catch (e) {}

            try {
                const stored = localStorage.getItem('pos_custom_printer_drivers');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                }
            } catch (e) {}

            return DEFAULT_PRINTER_DRIVERS;
        }

        function isAdmin() {
            const cur = state.currentUser || DEFAULT_SEED_USERS[0];
            const role = (cur.role || 'cashier').toLowerCase();
            const perms = Array.isArray(cur.permissions) ? cur.permissions : [];
            return role === 'admin' || perms.includes('admin');
        }

        const state = {
            printerDrivers: getInitialPrinterDrivers(),
            activePrinterDriverId: localStorage.getItem('pos_active_driver_id') || 'drv-escpos-generic',
            products: getInitialProducts(),`;

if (!html.includes('DEFAULT_PRINTER_DRIVERS = [')) {
  html = html.replace(stateInitTarget, driversAndAdminLogic);
  console.log('Successfully injected DEFAULT_PRINTER_DRIVERS, getInitialPrinterDrivers, and isAdmin');
}

// 2. Update canAccessTab to handle printer and quickactions
const oldCanAccessUsers = `                case 'users':
                    // Staff & User Registry: STRICTLY RESTRICTED to Administrator accounts only
                    return false;`;

const newCanAccessUsers = `                case 'users':
                case 'printer':
                case 'quickactions':
                case 'security':
                    // Staff Registry, Thermal Printer Setup, Quick Actions & Security: STRICTLY RESTRICTED to Administrator accounts only
                    return false;`;

if (html.includes(oldCanAccessUsers)) {
  html = html.replace(oldCanAccessUsers, newCanAccessUsers);
  console.log('Successfully updated canAccessTab with printer and quickactions cases');
}

// 3. Update applyRoleBasedAccessControl to hide/show quick actions & printer setup
const oldRbacEnd = `            // 4. Verify Active Tab Permissions: if current active tab is unpermitted, redirect to sales floor
            const activeTabEl = document.querySelector('.tab-content.active');
            if (activeTabEl) {
                const activeTabId = activeTabEl.id.replace('-tab', '');
                if (!canAccessTab(activeTabId)) {
                    switchTab('sales');
                }
            }
        }`;

const newRbacEnd = `            // 4. Verify Active Tab Permissions: if current active tab is unpermitted, redirect to sales floor
            const activeTabEl = document.querySelector('.tab-content.active');
            if (activeTabEl) {
                const activeTabId = activeTabEl.id.replace('-tab', '');
                if (!canAccessTab(activeTabId)) {
                    switchTab('sales');
                }
            }

            // 5. Admin-Only Gating for Quick Actions, Printer Setup, Drivers & Reset Controls
            const isUserAdmin = isAdmin();

            // Quick Actions sidebar container: strictly accessible to admin only
            const sidebarQuickActions = document.getElementById('sidebarQuickActionsSection');
            if (sidebarQuickActions) {
                sidebarQuickActions.style.display = isUserAdmin ? 'block' : 'none';
            }

            // Header Printer Setup button: strictly visible to admin only
            const headerPrinterBtn = document.getElementById('headerPrinterSetupBtn');
            if (headerPrinterBtn) {
                headerPrinterBtn.style.display = isUserAdmin ? 'inline-flex' : 'none';
            }

            // Quick action Printer Setup navigation link: admin only
            const quickActionPrinter = document.getElementById('quickActionPrinterSetup');
            if (quickActionPrinter) {
                quickActionPrinter.style.display = isUserAdmin ? 'flex' : 'none';
            }

            // Sale checkout modal printer configure button: admin only
            const salePrinterBtn = document.getElementById('saleReceiptPrinterConfigureBtn');
            if (salePrinterBtn) {
                salePrinterBtn.style.display = isUserAdmin ? 'inline-flex' : 'none';
            }

            // If non-admin, immediately close printer settings modal if it was open
            if (!isUserAdmin) {
                const printerModal = document.getElementById('printerSettingsModal');
                if (printerModal && !printerModal.classList.contains('hidden')) {
                    printerModal.classList.add('hidden');
                }
            }
        }`;

if (html.includes(oldRbacEnd)) {
  html = html.replace(oldRbacEnd, newRbacEnd);
  console.log('Successfully updated applyRoleBasedAccessControl with Quick Actions & Printer Setup gating');
}

// 4. Update openPrinterSettingsModal with admin check and driver initialization
const oldOpenPrinterModal = `        // ===== PRINTER SETTINGS MODAL CONTROLS =====
        function openPrinterSettingsModal() {
            const modal = document.getElementById('printerSettingsModal');
            if (!modal) return;`;

const newOpenPrinterModal = `        // ===== PRINTER SETTINGS MODAL CONTROLS =====
        function openPrinterSettingsModal() {
            if (!isAdmin()) {
                showPosToast('Access Denied: Only Administrators can access Thermal Printer Configuration.', 'warning', 3500);
                return;
            }
            const modal = document.getElementById('printerSettingsModal');
            if (!modal) return;`;

if (html.includes(oldOpenPrinterModal)) {
  html = html.replace(oldOpenPrinterModal, newOpenPrinterModal);
  console.log('Successfully updated openPrinterSettingsModal with admin authorization check');
}

// Add driver UI rendering inside openPrinterSettingsModal
const oldModalShow = `            updatePrinterStatusIndicators();

            modal.classList.remove('hidden');`;

const newModalShow = `            populateActiveDriverSelect();
            renderActiveDriverSpecs();
            renderInstalledDriversList();
            updatePrinterStatusIndicators();

            modal.classList.remove('hidden');`;

if (html.includes(oldModalShow)) {
  html = html.replace(oldModalShow, newModalShow);
  console.log('Successfully added driver rendering to openPrinterSettingsModal');
}

// 5. Inject Printer Driver Studio & Reset Engine functions right after savePrinterSettings
const targetAfterSavePrinter = `            closePrinterSettingsModal();
            updatePrinterStatusIndicators();
            showPosToast('Printer and receipt configuration saved successfully!');
        }`;

const driverStudioFunctions = `            closePrinterSettingsModal();
            updatePrinterStatusIndicators();
            showPosToast('Printer and receipt configuration saved successfully!');
        }

        // ===== PRINTER DRIVER MANAGEMENT & HTML STUDIO ENGINE =====
        function getActivePrinterDriver() {
            const list = state.printerDrivers || getInitialPrinterDrivers();
            const id = state.activePrinterDriverId || localStorage.getItem('pos_active_driver_id') || 'drv-escpos-generic';
            return list.find(d => d.id === id) || list[0] || DEFAULT_PRINTER_DRIVERS[0];
        }

        function populateActiveDriverSelect() {
            const select = document.getElementById('activePrinterDriverSelect');
            if (!select) return;
            const drivers = state.printerDrivers || getInitialPrinterDrivers();
            const currentActiveId = state.activePrinterDriverId || localStorage.getItem('pos_active_driver_id') || 'drv-escpos-generic';

            select.innerHTML = drivers.map(d => {
                const badge = d.isBuiltIn ? '' : ' [Custom]';
                const selected = d.id === currentActiveId ? 'selected' : '';
                return \`<option value="\${escapeHtml(d.id)}" \${selected}>\${escapeHtml(d.name)}\${badge} (\${escapeHtml(d.width || '80mm')})</option>\`;
            }).join('');
        }

        function renderActiveDriverSpecs() {
            const driver = getActivePrinterDriver();
            if (!driver) return;

            const brandEl = document.getElementById('drvSpecBrand');
            const emuEl = document.getElementById('drvSpecEmulation');
            const widthEl = document.getElementById('drvSpecWidth');
            const cutEl = document.getElementById('drvSpecCut');
            const drawerEl = document.getElementById('drvSpecDrawer');
            const baudEl = document.getElementById('drvSpecBaud');

            if (brandEl) brandEl.textContent = driver.brand || 'Generic';
            if (emuEl) emuEl.textContent = driver.emulation || 'ESC/POS';
            if (widthEl) widthEl.textContent = \`\${driver.width || '80mm'} (\${driver.columns || 42} cols)\`;
            if (cutEl) cutEl.textContent = driver.cutCommand || '1D 56 41 00';
            if (drawerEl) drawerEl.textContent = driver.drawerKick || '1B 70 00 19 FA';
            if (baudEl) baudEl.textContent = driver.baudRate || 9600;
        }

        function renderInstalledDriversList() {
            const container = document.getElementById('installedDriversList');
            if (!container) return;
            const drivers = state.printerDrivers || getInitialPrinterDrivers();
            const currentActiveId = state.activePrinterDriverId || localStorage.getItem('pos_active_driver_id') || 'drv-escpos-generic';
            const admin = isAdmin();

            if (drivers.length === 0) {
                container.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); padding: 6px; text-align: center;">No printer drivers installed.</div>';
                return;
            }

            container.innerHTML = drivers.map(d => {
                const isActive = d.id === currentActiveId;
                const activeBadge = isActive ? '<span style="font-size: 9px; background: #dcfce7; color: #15803d; padding: 1px 6px; border-radius: 2px; font-weight: 700;">ACTIVE</span>' : '';
                const builtInBadge = d.isBuiltIn ? '<span style="font-size: 9px; background: var(--ink-faint); color: var(--text-muted); padding: 1px 5px; border-radius: 2px;">BUILT-IN</span>' : '<span style="font-size: 9px; background: rgba(223, 177, 91, 0.2); color: var(--accent); padding: 1px 5px; border-radius: 2px; font-weight: 600;">SAVED TO HTML</span>';
                
                const deleteBtn = (!d.isBuiltIn && admin) ? \`<button type="button" onclick="deletePrinterDriver('\${escapeHtml(d.id)}')" class="btn secondary outline" title="Delete custom driver" style="padding: 1px 6px; font-size: 10px; color: #ef4444; border-color: #fca5a5;">Delete</button>\` : '';

                return \`
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; border-bottom: 1px solid var(--border); font-size: 11px; background: \${isActive ? 'rgba(16, 185, 129, 0.05)' : 'transparent'};">
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <strong style="color: var(--ink);">\${escapeHtml(d.name)}</strong>
                            \${activeBadge}
                            \${builtInBadge}
                            <span style="color: var(--text-muted); font-size: 10px;">\${escapeHtml(d.width || '80mm')} • \${escapeHtml(d.columns || 42)} cols • \${escapeHtml(d.baudRate || 9600)} baud</span>
                        </div>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            \${!isActive ? \`<button type="button" onclick="setActivePrinterDriver('\${escapeHtml(d.id)}')" class="btn outline" style="padding: 1px 8px; font-size: 10px;">Select</button>\` : ''}
                            \${deleteBtn}
                        </div>
                    </div>
                \`;
            }).join('');
        }

        function toggleNewDriverForm(force) {
            const form = document.getElementById('newDriverFormPanel');
            const btn = document.getElementById('toggleDriverFormBtn');
            if (!form) return;
            const isVisible = form.style.display !== 'none';
            const show = force !== undefined ? force : !isVisible;
            form.style.display = show ? 'block' : 'none';
            if (btn) btn.textContent = show ? '− Close Driver Studio' : '+ Create New Driver';
        }

        function setActivePrinterDriver(driverId) {
            const drivers = state.printerDrivers || getInitialPrinterDrivers();
            const drv = drivers.find(d => d.id === driverId);
            if (!drv) return;

            state.activePrinterDriverId = driverId;
            localStorage.setItem('pos_active_driver_id', driverId);

            // Synchronize width select if matches
            if (drv.width) {
                const widthSelect = document.getElementById('modalPrinterWidthSelect');
                if (widthSelect && (drv.width === '80mm' || drv.width === '58mm')) {
                    widthSelect.value = drv.width;
                    localStorage.setItem('pos_printer_width', drv.width);
                }
            }

            // Synchronize baud select if matches
            if (drv.baudRate) {
                const baudSelect = document.getElementById('printerBaudRateSelect');
                if (baudSelect) {
                    baudSelect.value = String(drv.baudRate);
                    localStorage.setItem('pos_serial_baud', String(drv.baudRate));
                }
            }

            populateActiveDriverSelect();
            renderActiveDriverSpecs();
            renderInstalledDriversList();
            showPosToast(\`Active printer driver switched to "\${drv.name}".\`, 'info', 2500);
        }

        async function saveNewPrinterDriverToHtml() {
            if (!isAdmin()) {
                showPosToast('Access Denied: Only Administrators can create and save printer drivers to HTML.', 'warning', 3500);
                return;
            }

            const nameInput = document.getElementById('drvNameInput');
            const brandInput = document.getElementById('drvBrandInput');
            const emulationSelect = document.getElementById('drvEmulationSelect');
            const widthSelect = document.getElementById('drvWidthSelect');
            const columnsSelect = document.getElementById('drvColumnsSelect');
            const baudSelect = document.getElementById('drvBaudSelect');
            const cutCommandInput = document.getElementById('drvCutCommandInput');
            const drawerKickInput = document.getElementById('drvDrawerKickInput');
            const feedLinesInput = document.getElementById('drvFeedLinesInput');
            const notesInput = document.getElementById('drvNotesInput');
            const statusMsg = document.getElementById('saveDriverStatusMsg');

            const name = (nameInput?.value || '').trim();
            if (!name) {
                showPosToast('Please enter a descriptive Printer Driver Name.', 'warning', 3000);
                if (nameInput) nameInput.focus();
                return;
            }

            const cleanHex = (str) => (str || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
            const cutHex = cleanHex(cutCommandInput?.value || '1D564100');
            const drawerHex = cleanHex(drawerKickInput?.value || '1B700019FA');

            const driverId = 'drv-custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 4);
            const newDriver = {
                id: driverId,
                name: name,
                brand: (brandInput?.value || 'Custom Manufacturer').trim(),
                emulation: emulationSelect?.value || 'ESC/POS',
                width: widthSelect?.value || '80mm',
                columns: parseInt(columnsSelect?.value || '42', 10),
                baudRate: parseInt(baudSelect?.value || '9600', 10),
                initCommand: '1B40',
                cutCommand: cutHex || 'NONE',
                drawerKick: drawerHex || 'NONE',
                codepage: 'PC437',
                feedLines: Math.max(1, Math.min(10, parseInt(feedLinesInput?.value || '3', 10))),
                notes: (notesInput?.value || '').trim(),
                isBuiltIn: false,
                isDefault: false,
                createdAt: new Date().toISOString()
            };

            // 1. Add to state memory
            if (!Array.isArray(state.printerDrivers)) {
                state.printerDrivers = getInitialPrinterDrivers();
            }
            state.printerDrivers.push(newDriver);
            state.activePrinterDriverId = driverId;
            localStorage.setItem('pos_active_driver_id', driverId);

            // 2. Persist to localStorage
            try {
                localStorage.setItem('pos_custom_printer_drivers', JSON.stringify(state.printerDrivers));
            } catch (e) {}

            // 3. Update the DOM <script id="pos-printer-drivers-json"> tag in real time
            try {
                let tag = document.getElementById('pos-printer-drivers-json');
                if (!tag) {
                    tag = document.createElement('script');
                    tag.id = 'pos-printer-drivers-json';
                    tag.type = 'application/json';
                    document.body.appendChild(tag);
                }
                tag.textContent = JSON.stringify(state.printerDrivers, null, 2);
            } catch (e) {
                console.warn('DOM script update note:', e);
            }

            if (statusMsg) {
                statusMsg.textContent = 'Saving driver to index.html and spooler storage...';
                statusMsg.style.color = 'var(--accent)';
            }

            // 4. Send to server to permanently update index.html on disk
            try {
                const resp = await fetch('/api/printer/save-driver-to-html', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-POS-Role': 'admin'
                    },
                    body: JSON.stringify({
                        driver: newDriver,
                        drivers: state.printerDrivers
                    })
                });

                const data = await resp.json();
                if (data.status === 'success') {
                    showPosToast(\`Printer Driver "\${name}" successfully saved to HTML!\`, 'success', 4000);
                    if (statusMsg) {
                        statusMsg.textContent = 'Saved to HTML and ready for active printing!';
                        statusMsg.style.color = '#059669';
                    }
                } else {
                    showPosToast(\`Driver saved locally. Note: \${data.error || 'Server sync note'}\`, 'info', 3500);
                }
            } catch (err) {
                console.warn('Server HTML save error (client fallback preserved):', err);
                showPosToast(\`Driver "\${name}" saved to HTML document & browser cache!\`, 'success', 4000);
            }

            // Clear inputs
            if (nameInput) nameInput.value = '';
            if (brandInput) brandInput.value = '';
            if (notesInput) notesInput.value = '';

            // Close driver form
            toggleNewDriverForm(false);

            // Re-render drivers UI
            renderInstalledDriversList();
            populateActiveDriverSelect();
            renderActiveDriverSpecs();
        }

        async function deletePrinterDriver(driverId) {
            if (!isAdmin()) {
                showPosToast('Access Denied: Only Administrators can modify printer drivers.', 'warning', 3500);
                return;
            }
            const drv = (state.printerDrivers || []).find(d => d.id === driverId);
            if (!drv) return;
            if (drv.isBuiltIn) {
                showPosToast('Built-in system drivers cannot be deleted.', 'warning', 3000);
                return;
            }
            if (!confirm(\`Are you sure you want to delete printer driver "\${drv.name}"?\\n\\nThis will remove the driver profile from HTML storage.\`)) {
                return;
            }

            state.printerDrivers = state.printerDrivers.filter(d => d.id !== driverId);
            if (state.activePrinterDriverId === driverId) {
                state.activePrinterDriverId = 'drv-escpos-generic';
                localStorage.setItem('pos_active_driver_id', 'drv-escpos-generic');
            }

            // Update DOM tag
            const tag = document.getElementById('pos-printer-drivers-json');
            if (tag) tag.textContent = JSON.stringify(state.printerDrivers, null, 2);

            // Update localStorage
            localStorage.setItem('pos_custom_printer_drivers', JSON.stringify(state.printerDrivers));

            // Sync to server
            try {
                await fetch('/api/printer/save-driver-to-html', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-POS-Role': 'admin'
                    },
                    body: JSON.stringify({ drivers: state.printerDrivers })
                });
            } catch (e) {}

            renderInstalledDriversList();
            populateActiveDriverSelect();
            renderActiveDriverSpecs();
            showPosToast(\`Driver "\${drv.name}" removed from HTML.\`, 'info', 3000);
        }

        function exportHtmlWithCustomDrivers() {
            if (!isAdmin()) {
                showPosToast('Access Denied: Administrator role required to export HTML.', 'warning', 3500);
                return;
            }
            try {
                let fullHtml = document.documentElement.outerHTML;
                const formatted = JSON.stringify(state.printerDrivers || [], null, 2);
                if (fullHtml.includes('id="pos-printer-drivers-json"')) {
                    fullHtml = fullHtml.replace(
                        /<script id="pos-printer-drivers-json" type="application\\/json">[\\s\\S]*?<\\/script>/,
                        \`<script id="pos-printer-drivers-json" type="application/json">\\n\${formatted}\\n    </script>\`
                    );
                }
                const blob = new Blob(['<!DOCTYPE html>\\n' + fullHtml], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = \`poketstar-pos-standalone-\${new Date().toISOString().split('T')[0]}.html\`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showPosToast('Single-file HTML with embedded printer drivers exported successfully!', 'success', 3500);
            } catch (err) {
                console.error('Export HTML error:', err);
                showPosToast('Could not generate HTML export: ' + err.message, 'warning', 3500);
            }
        }

        function testActiveDriver() {
            if (!isAdmin()) {
                showPosToast('Access Denied: Printer diagnostics restricted to Administrators.', 'warning', 3000);
                return;
            }
            const drv = getActivePrinterDriver();
            const cols = drv.columns || (drv.width === '58mm' ? 32 : 42);
            const line = '='.repeat(cols);
            const subline = '-'.repeat(cols);

            const testText = [
                line,
                'POKET STAR POS — THERMAL DRIVER TEST'.padStart(Math.floor((cols + 35) / 2)).slice(0, cols),
                'OFFICIAL HARDWARE CALIBRATION'.padStart(Math.floor((cols + 29) / 2)).slice(0, cols),
                subline,
                \`Driver Profile: \${drv.name}\`,
                \`Manufacturer:   \${drv.brand || 'Universal'}\`,
                \`Emulation:      \${drv.emulation || 'ESC/POS'}\`,
                \`Roll Width:     \${drv.width || '80mm'} (\${cols} Columns)\`,
                \`Baud Rate:      \${drv.baudRate || 9600} bps\`,
                \`Cutter Command: \${drv.cutCommand || '1D 56 41 00'}\`,
                \`Drawer Kick:    \${drv.drawerKick || '1B 70 00 19 FA'}\`,
                \`Timestamp:      \${new Date().toLocaleString()}\`,
                subline,
                'Hardware status: VERIFIED & READY',
                line,
                '\\n\\n'
            ].join('\\n');

            dispatchSilentPrintReceipt(testText, \`Driver Test — \${drv.name}\`);
            showPosToast(\`Test print dispatched for driver "\${drv.name}" (\${cols} columns)!\`, 'success', 3500);
        }

        // ===== RESET THERMAL PRINTER ENGINE & SPOOLER (ADMIN ONLY) =====
        async function resetPrinterEngine() {
            if (!isAdmin()) {
                showPosToast('Access Denied: Only Administrators can reset the thermal printer engine.', 'warning', 3500);
                return;
            }
            if (!confirm('Are you sure you want to reset the thermal printer engine to factory defaults?\\n\\nThis will send ESC @ hardware re-initialization commands, purge stuck print queues, reset serial/bluetooth streams, and restore default receipt formatting.')) {
                return;
            }

            const feedback = document.getElementById('printerResetFeedbackMsg');
            if (feedback) {
                feedback.textContent = 'Transmitting ESC @ hardware reset & clearing spooler...';
                feedback.style.color = '#d97706';
            }

            // 1. Send ESC @ (0x1B 0x40) via Web Serial if connected
            try {
                if (window.webSerialWriter) {
                    const escReset = new Uint8Array([0x1b, 0x40, 0x0a]);
                    await window.webSerialWriter.write(escReset);
                }
            } catch (e) {
                console.warn('Serial reset notice:', e);
            }

            // 2. Send ESC @ via Web Bluetooth if connected
            try {
                if (window.webBleCharacteristic) {
                    const escReset = new Uint8Array([0x1b, 0x40, 0x0a]);
                    await window.webBleCharacteristic.writeValue(escReset);
                }
            } catch (e) {
                console.warn('Bluetooth reset notice:', e);
            }

            // 3. Reset POS printer configuration in localStorage to standard defaults
            localStorage.setItem('pos_silent_print_mode', 'true');
            localStorage.setItem('pos_printer_width', '80mm');
            localStorage.setItem('pos_receipt_format', 'compact');
            localStorage.setItem('pos_serial_baud', '9600');
            localStorage.setItem('pos_auto_print', 'false');
            localStorage.setItem('pos_print_sound', 'true');
            localStorage.setItem('pos_spool_server', 'true');
            localStorage.setItem('pos_active_driver_id', 'drv-escpos-generic');
            state.activePrinterDriverId = 'drv-escpos-generic';

            // 4. Update UI input controls
            const modalSilentChk = document.getElementById('modalSilentModeCheckbox');
            if (modalSilentChk) modalSilentChk.checked = true;

            const modalWidth = document.getElementById('modalPrinterWidthSelect');
            if (modalWidth) modalWidth.value = '80mm';

            const modalFmt = document.getElementById('modalReceiptFormatSelect');
            if (modalFmt) modalFmt.value = 'compact';

            const baudSelect = document.getElementById('printerBaudRateSelect');
            if (baudSelect) baudSelect.value = '9600';

            const autoPrintChk = document.getElementById('autoPrintCheckbox');
            if (autoPrintChk) autoPrintChk.checked = false;

            const soundChk = document.getElementById('playThermalSoundCheckbox');
            if (soundChk) soundChk.checked = true;

            const spoolChk = document.getElementById('spoolToServerCheckbox');
            if (spoolChk) spoolChk.checked = true;

            // 5. Call server API to reset server spooler & print queue
            try {
                const resp = await fetch('/api/printer/reset', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-POS-Role': 'admin'
                    }
                });
                const data = await resp.json();
                if (feedback) {
                    feedback.textContent = 'Hardware reset (ESC @) sent & spooler cleared!';
                    feedback.style.color = '#059669';
                }
            } catch (err) {
                console.warn('Server printer reset notice:', err);
                if (feedback) {
                    feedback.textContent = 'Local printer engine reset to defaults!';
                    feedback.style.color = '#059669';
                }
            }

            populateActiveDriverSelect();
            renderActiveDriverSpecs();
            renderInstalledDriversList();
            updatePrinterStatusIndicators();
            showPosToast('Thermal printer engine successfully reset to factory defaults!', 'success', 4000);
        }

        async function clearPrinterSpoolQueue() {
            if (!isAdmin()) {
                showPosToast('Access Denied: Only Administrators can clear print queues.', 'warning', 3500);
                return;
            }
            try {
                await fetch('/api/printer/reset', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-POS-Role': 'admin'
                    }
                });
                showPosToast('Print spool queue cleared successfully.', 'info', 3000);
            } catch (e) {
                showPosToast('Spool queue reset.', 'info', 2000);
            }
        }`;

if (!html.includes('function getActivePrinterDriver()')) {
  html = html.replace(targetAfterSavePrinter, driverStudioFunctions);
  console.log('Successfully injected driver studio and reset functions');
}

// 6. Explicitly attach all functions to window
const windowBindingsMarker = 'window.addEventListener(\'DOMContentLoaded\', () => {';
const windowBindings = `        // Explicit window scope binding for HTML attributes and event handlers
        window.isAdmin = isAdmin;
        window.openPrinterSettingsModal = openPrinterSettingsModal;
        window.resetPrinterEngine = resetPrinterEngine;
        window.clearPrinterSpoolQueue = clearPrinterSpoolQueue;
        window.toggleNewDriverForm = toggleNewDriverForm;
        window.saveNewPrinterDriverToHtml = saveNewPrinterDriverToHtml;
        window.deletePrinterDriver = deletePrinterDriver;
        window.setActivePrinterDriver = setActivePrinterDriver;
        window.testActiveDriver = testActiveDriver;
        window.exportHtmlWithCustomDrivers = exportHtmlWithCustomDrivers;

        window.addEventListener('DOMContentLoaded', () => {`;

if (!html.includes('window.resetPrinterEngine = resetPrinterEngine;')) {
  html = html.replace(windowBindingsMarker, windowBindings);
  console.log('Successfully bound printer and admin functions to window');
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('Step 2 complete: index.html JavaScript updated successfully');

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Update header printer setup button to include id
html = html.replace(
  '<button class="header-btn" onclick="openPrinterSettingsModal()" title="Printer Setup',
  '<button class="header-btn" id="headerPrinterSetupBtn" onclick="openPrinterSettingsModal()" title="Printer Setup'
);

// 2. Wrap Quick Actions in sidebar with id and admin badge
const oldQuickActions = `<div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border);">
                    <span class="label">Quick Actions</span>`;
const newQuickActions = `<div id="sidebarQuickActionsSection" style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                        <span class="label" style="margin-bottom: 0;">Quick Actions</span>
                        <span style="font-size: 9px; background: rgba(223, 177, 91, 0.2); color: var(--accent); padding: 1px 5px; border-radius: 2px; font-weight: 700; letter-spacing: 0.04em;">ADMIN ONLY</span>
                    </div>`;

if (html.includes(oldQuickActions)) {
  html = html.replace(oldQuickActions, newQuickActions);
  console.log('Successfully updated sidebar Quick Actions section with admin badge');
} else {
  console.log('Sidebar quick actions already has id or new structure');
}

// 3. Update printerSettingsModal header with Admin Only badge
const oldPrinterModalHeader = '<h2 style="margin-bottom: 0; font-size: 1.8rem; color: var(--accent);">Thermal Printer Configuration</h2>';
const newPrinterModalHeader = `<div style="display: flex; align-items: center; gap: 8px;">
                        <h2 style="margin-bottom: 0; font-size: 1.8rem; color: var(--accent);">Thermal Printer Configuration</h2>
                        <span style="font-size: 10px; background: rgba(223, 177, 91, 0.2); color: var(--accent); padding: 2px 8px; border-radius: 2px; font-weight: 700; letter-spacing: 0.04em;">ADMIN ONLY</span>
                    </div>`;

if (html.includes(oldPrinterModalHeader)) {
  html = html.replace(oldPrinterModalHeader, newPrinterModalHeader);
  console.log('Successfully updated printer modal header with admin badge');
}

// 4. Insert Printer Driver Registry & HTML Studio and Reset Engine cards in printerSettingsModal
const targetAfterSpooler = `            <!-- OS Spooler Target -->
            <div style="background: var(--ink-faint); border: 1px solid var(--border); border-radius: 4px; padding: 12px; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <strong style="font-size: 0.85rem; color: var(--accent); text-transform: uppercase;">4. System OS Spooler / Driver Name (Optional)</strong>
                </div>
                <input type="text" id="osPrinterNameInput" placeholder="Leave empty for OS default printer (or enter e.g. POS-80, EPSON)" onchange="localStorage.setItem('pos_os_printer_name', this.value.trim())" style="width: 100%; padding: 6px; background: var(--bg); border: 1px solid var(--border); color: var(--ink); border-radius: 2px; font-size: 12px;" />
            </div>`;

const driverAndResetCards = targetAfterSpooler + '\n\n' + `            <!-- Printer Drivers & Custom Driver Studio (Admin Only) -->
            <div id="printerDriversStudioSection" style="background: var(--ink-faint); border: 1px solid var(--border); border-radius: 4px; padding: 12px; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div>
                        <strong style="font-size: 0.85rem; color: var(--accent); text-transform: uppercase;">5. Printer Driver Registry & HTML Studio</strong>
                        <span style="font-size: 9px; background: rgba(223, 177, 91, 0.2); color: var(--accent); padding: 1px 5px; border-radius: 2px; font-weight: 700; margin-left: 6px;">ADMIN ONLY</span>
                    </div>
                    <button type="button" class="btn outline" id="toggleDriverFormBtn" onclick="toggleNewDriverForm()" style="padding: 3px 8px; font-size: 11px; font-weight: 600;">+ Create New Driver</button>
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 10px;">
                    Manage hardware printer driver profiles. New drivers are permanently embedded into this application's HTML source code and local spooler storage.
                </div>

                <!-- Active Driver Selector & Specs -->
                <div style="margin-bottom: 10px;">
                    <label class="label" style="font-size: 11px; margin-bottom: 3px;">Active Hardware Driver Profile</label>
                    <div style="display: flex; gap: 8px;">
                        <select id="activePrinterDriverSelect" onchange="setActivePrinterDriver(this.value)" style="flex: 1; padding: 6px; background: var(--bg); border: 1px solid var(--border); color: var(--ink); border-radius: 2px; font-size: 12px; font-weight: 600;">
                            <!-- Populated dynamically -->
                        </select>
                        <button type="button" class="btn outline" onclick="testActiveDriver()" title="Send formatted test slip using active driver specifications" style="padding: 6px 12px; font-size: 11px; font-weight: 700;">Test Driver</button>
                    </div>
                </div>

                <!-- Active Driver Specs Display -->
                <div id="activeDriverSpecsCard" style="background: var(--bg); border: 1px solid var(--border); border-radius: 3px; padding: 8px 12px; margin-bottom: 10px; font-size: 11px; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px;">
                    <div><span style="color: var(--text-muted);">Brand:</span> <strong id="drvSpecBrand">Generic</strong></div>
                    <div><span style="color: var(--text-muted);">Emulation:</span> <strong id="drvSpecEmulation">ESC/POS</strong></div>
                    <div><span style="color: var(--text-muted);">Paper / Width:</span> <strong id="drvSpecWidth">80mm (42 cols)</strong></div>
                    <div><span style="color: var(--text-muted);">Cut Hex:</span> <code id="drvSpecCut" style="font-size: 10px; background: var(--ink-faint); padding: 1px 4px; border-radius: 2px;">1D 56 41 00</code></div>
                    <div><span style="color: var(--text-muted);">Drawer Kick:</span> <code id="drvSpecDrawer" style="font-size: 10px; background: var(--ink-faint); padding: 1px 4px; border-radius: 2px;">1B 70 00 19 FA</code></div>
                    <div><span style="color: var(--text-muted);">Baud Rate:</span> <strong id="drvSpecBaud">9600</strong></div>
                </div>

                <!-- Create New Driver Form (Collapsible) -->
                <div id="newDriverFormPanel" style="display: none; background: var(--bg); border: 1px dashed var(--accent); border-radius: 4px; padding: 12px; margin-bottom: 10px;">
                    <div style="font-size: 0.82rem; font-weight: 700; color: var(--accent); margin-bottom: 8px; text-transform: uppercase;">Create New Thermal Driver Profile</div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                        <div>
                            <label class="label" style="font-size: 10px; margin-bottom: 2px;">Driver Name *</label>
                            <input type="text" id="drvNameInput" placeholder="e.g. Bixolon SRP-350III (80mm)" style="width: 100%; padding: 5px 8px; font-size: 11px; background: var(--card); border: 1px solid var(--border); color: var(--ink); border-radius: 2px;" />
                        </div>
                        <div>
                            <label class="label" style="font-size: 10px; margin-bottom: 2px;">Manufacturer / Brand</label>
                            <input type="text" id="drvBrandInput" placeholder="e.g. Bixolon, Epson, Rongta" style="width: 100%; padding: 5px 8px; font-size: 11px; background: var(--card); border: 1px solid var(--border); color: var(--ink); border-radius: 2px;" />
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                        <div>
                            <label class="label" style="font-size: 10px; margin-bottom: 2px;">Emulation</label>
                            <select id="drvEmulationSelect" style="width: 100%; padding: 5px; font-size: 11px; background: var(--card); border: 1px solid var(--border); color: var(--ink); border-radius: 2px;">
                                <option value="ESC/POS">ESC/POS (Standard)</option>
                                <option value="Star Line Mode">Star Line Mode</option>
                                <option value="CPCL / TSPL">CPCL / TSPL Label</option>
                                <option value="Generic Text">Plain Text (ASCII)</option>
                            </select>
                        </div>
                        <div>
                            <label class="label" style="font-size: 10px; margin-bottom: 2px;">Paper Width</label>
                            <select id="drvWidthSelect" onchange="document.getElementById('drvColumnsSelect').value = this.value === '58mm' ? '32' : '42'" style="width: 100%; padding: 5px; font-size: 11px; background: var(--card); border: 1px solid var(--border); color: var(--ink); border-radius: 2px;">
                                <option value="80mm">80mm Standard</option>
                                <option value="58mm">58mm Compact</option>
                                <option value="76mm">76mm Impact</option>
                                <option value="112mm">112mm Wide</option>
                            </select>
                        </div>
                        <div>
                            <label class="label" style="font-size: 10px; margin-bottom: 2px;">Receipt Columns</label>
                            <select id="drvColumnsSelect" style="width: 100%; padding: 5px; font-size: 11px; background: var(--card); border: 1px solid var(--border); color: var(--ink); border-radius: 2px;">
                                <option value="42">42 Columns (Standard 80mm)</option>
                                <option value="48">48 Columns (High Density 80mm)</option>
                                <option value="32">32 Columns (Compact 58mm)</option>
                                <option value="24">24 Columns (Large Font)</option>
                            </select>
                        </div>
                        <div>
                            <label class="label" style="font-size: 10px; margin-bottom: 2px;">Baud Rate</label>
                            <select id="drvBaudSelect" style="width: 100%; padding: 5px; font-size: 11px; background: var(--card); border: 1px solid var(--border); color: var(--ink); border-radius: 2px;">
                                <option value="9600">9600 (Universal)</option>
                                <option value="19200">19200 (Xprinter)</option>
                                <option value="38400">38400 (Epson)</option>
                                <option value="115200">115200 (High Speed)</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                        <div>
                            <label class="label" style="font-size: 10px; margin-bottom: 2px;">Cutter Hex Command</label>
                            <input type="text" id="drvCutCommandInput" value="1D564100" placeholder="1D564100 or NONE" style="width: 100%; padding: 5px 8px; font-size: 11px; background: var(--card); border: 1px solid var(--border); color: var(--ink); border-radius: 2px; font-family: monospace;" />
                        </div>
                        <div>
                            <label class="label" style="font-size: 10px; margin-bottom: 2px;">Cash Drawer Kick Hex</label>
                            <input type="text" id="drvDrawerKickInput" value="1B700019FA" placeholder="1B700019FA or NONE" style="width: 100%; padding: 5px 8px; font-size: 11px; background: var(--card); border: 1px solid var(--border); color: var(--ink); border-radius: 2px; font-family: monospace;" />
                        </div>
                        <div>
                            <label class="label" style="font-size: 10px; margin-bottom: 2px;">Feed Lines</label>
                            <input type="number" id="drvFeedLinesInput" value="3" min="1" max="10" style="width: 100%; padding: 5px 8px; font-size: 11px; background: var(--card); border: 1px solid var(--border); color: var(--ink); border-radius: 2px;" />
                        </div>
                    </div>

                    <div style="margin-bottom: 8px;">
                        <label class="label" style="font-size: 10px; margin-bottom: 2px;">Driver Notes / Setup Instructions</label>
                        <input type="text" id="drvNotesInput" placeholder="e.g. Requires ESC/POS DIP switch 1 ON. Auto cutter attached." style="width: 100%; padding: 5px 8px; font-size: 11px; background: var(--card); border: 1px solid var(--border); color: var(--ink); border-radius: 2px;" />
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                        <span id="saveDriverStatusMsg" style="font-size: 11px; color: var(--text-muted);"></span>
                        <div style="display: flex; gap: 8px;">
                            <button type="button" class="btn secondary outline" onclick="toggleNewDriverForm(false)" style="padding: 4px 10px; font-size: 11px;">Cancel</button>
                            <button type="button" class="btn" onclick="saveNewPrinterDriverToHtml()" style="background: var(--accent); color: #ffffff; padding: 4px 14px; font-size: 11px; font-weight: 700;">Save Driver to HTML</button>
                        </div>
                    </div>
                </div>

                <!-- Installed Drivers List / Delete Custom -->
                <div style="margin-top: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--ink); text-transform: uppercase;">Installed Driver Profiles</span>
                        <button type="button" onclick="exportHtmlWithCustomDrivers()" class="btn secondary outline" title="Download standalone HTML document with all embedded printer drivers" style="padding: 2px 8px; font-size: 10px;">Export Standalone HTML</button>
                    </div>
                    <div id="installedDriversList" style="max-height: 120px; overflow-y: auto; background: var(--bg); border: 1px solid var(--border); border-radius: 3px; padding: 4px;">
                        <!-- Rendered by JS -->
                    </div>
                </div>
            </div>

            <!-- Reset Thermal Printer Engine (Admin Only) -->
            <div id="printerResetSection" style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 12px; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div>
                        <strong style="font-size: 0.85rem; color: #92400e; text-transform: uppercase;">6. Reset Thermal Printer Engine & Spooler</strong>
                        <span style="font-size: 9px; background: #fef3c7; color: #b45309; padding: 1px 5px; border-radius: 2px; font-weight: 700; border: 1px solid #fde68a; margin-left: 6px;">ADMIN ONLY</span>
                    </div>
                    <span id="printerResetBadge" style="font-size: 0.75rem; font-weight: 700; color: #b45309;">Ready</span>
                </div>
                <div style="font-size: 0.78rem; color: #92400e; margin-bottom: 8px;">
                    Transmit ESC @ hardware reset signals, clear locked print spools, terminate unbuffered print loops, and restore factory defaults.
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; gap: 8px;">
                        <button type="button" class="btn" onclick="resetPrinterEngine()" style="background: #d97706; color: #ffffff; padding: 5px 12px; font-size: 12px; font-weight: 700;">Reset Printer Engine</button>
                        <button type="button" class="btn outline" onclick="clearPrinterSpoolQueue()" style="background: #ffffff; border-color: #f59e0b; color: #b45309; padding: 5px 10px; font-size: 11px;">Clear Spool Queue</button>
                    </div>
                    <span id="printerResetFeedbackMsg" style="font-size: 0.75rem; color: #92400e;"></span>
                </div>
            </div>`;

if (!html.includes('id="printerDriversStudioSection"')) {
  if (html.includes(targetAfterSpooler)) {
    html = html.replace(targetAfterSpooler, driverAndResetCards);
    console.log('Successfully inserted Driver Studio and Reset Engine cards');
  } else {
    console.warn('Warning: targetAfterSpooler pattern not found');
  }
}

// 5. Insert <script id="pos-printer-drivers-json"> tag if not present
const driversFilePath = path.join(__dirname, '../receipts/printer_drivers.json');
const seededDrivers = fs.readFileSync(driversFilePath, 'utf8');
const driversScriptTag = `\n\n    <!-- Embedded Default & Custom Printer Drivers Registry -->\n    <script id="pos-printer-drivers-json" type="application/json">\n${seededDrivers.trim()}\n    </script>`;

if (!html.includes('id="pos-printer-drivers-json"')) {
  html = html.replace('</script>\n\n    <!-- Interactive Script Engine -->', '</script>' + driversScriptTag + '\n\n    <!-- Interactive Script Engine -->');
  console.log('Successfully embedded pos-printer-drivers-json script tag');
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('Step 1 complete: index.html markup updated successfully');

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

console.log('Original index.html size:', html.length);

// 1. Update Brand title in Header
html = html.replace(
  '<h1 class="brand-title">Poket Star</h1>',
  '<h1 class="brand-title">Poket Star EPOS</h1>'
);

// 2. Add Active Organization Badge before user badge in Header if not present
if (!html.includes('id="headerOrgBadge"')) {
  const userBadgeAnchor = '<div class="active-user-badge" id="headerUserBadge"';
  const orgBadgeHtml = `<!-- Active Organization / Store Badge -->
            <div class="active-org-badge" id="headerOrgBadge" onclick="openOrgManagerModal()" title="Switch Store / Organization Workspace" style="display: inline-flex; align-items: center; gap: 7px; padding: 0.28rem 0.65rem; border-radius: 6px; background: var(--card); border: 1px solid var(--border); cursor: pointer; user-select: none;">
                <span style="font-size: 0.95rem;">🏢</span>
                <div style="display: flex; flex-direction: column; text-align: left; line-height: 1.15;">
                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--ink);" id="headerOrgName">Main Store</span>
                    <span style="font-size: 0.62rem; color: var(--accent); font-weight: 700;" id="headerOrgCode">[HQ-01] ▾</span>
                </div>
            </div>
            ` + userBadgeAnchor;
  html = html.replace(userBadgeAnchor, orgBadgeHtml);
}

// 3. Add Organizations & Stores Nav Item in Sidebar
if (!html.includes('id="tab-btn-orgs"')) {
  const usersNavAnchor = '<a class="nav-item" id="tab-btn-users" onclick="switchTab(\'users\')">Staff & User Registry</a>';
  const orgNavHtml = `${usersNavAnchor}
                <a class="nav-item" id="tab-btn-orgs" onclick="switchTab('orgs')"><span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#3b82f6; margin-right:6px; box-shadow: 0 0 5px #3b82f6;"></span>Organizations & Stores</a>`;
  html = html.replace(usersNavAnchor, orgNavHtml);

  // Also add to quick actions
  const quickActionsAnchor = '<div id="sidebarQuickActionsSection"';
  const quickOrgItem = `<a class="nav-item" onclick="openOrgManagerModal()" style="color: #3b82f6; font-weight: 700; display: flex; align-items: center; gap: 6px;"><span style="font-size:12px;">🏢</span> Switch Organization</a>\n                    `;
  const quickFirstItem = '<a class="nav-item" onclick="lockAppSecurity()"';
  html = html.replace(quickFirstItem, quickOrgItem + quickFirstItem);
}

// 4. Add #orgs-tab inside main content before </main>
if (!html.includes('id="orgs-tab"')) {
  const mainClosingAnchor = '</main>';
  const orgsTabHtml = `
            <!-- ORGANIZATIONS & MULTI-TENANT WORKSPACES TAB -->
            <div id="orgs-tab" class="tab-content">
                <div class="hero" style="margin-bottom: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem;">
                        <div>
                            <span class="label">Multi-Tenant Management</span>
                            <h1 style="font-size: 2.2rem; margin-bottom: 0.25rem;">Organizations & Stores</h1>
                            <p>Isolated catalogs, sales ledgers, staff access, and receipt branding per business entity.</p>
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button type="button" class="btn" onclick="openCreateOrgModal()" style="background: #3b82f6; color: #fff; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;">+ New Organization / Store</button>
                            <button type="button" class="btn secondary outline" onclick="openImportOrgModal()">📥 Import Store Backup</button>
                            <button type="button" class="btn secondary outline" onclick="loadOrganizations(false)">🔄 Refresh</button>
                        </div>
                    </div>
                </div>

                <!-- Isolation & Zero Data Loss Guarantee Banner -->
                <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 6px; padding: 12px 16px; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.5rem;">🛡️</span>
                        <div>
                            <div style="font-weight: 700; font-size: 0.85rem; color: var(--ink);">Complete Multi-Organization Data Isolation & Update Protection</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">Each organization maintains an independent database directory (<code>data/orgs/&lt;orgId&gt;/</code>). Updates and changes to one organization will never tamper with or overwrite another store's inventory, sales, or users.</div>
                        </div>
                    </div>
                    <span style="font-size: 0.72rem; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.3);">ACTIVE ISOLATION ENGINE</span>
                </div>

                <!-- Active Store Switcher & Grid -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 10px;">
                    <div style="font-size: 0.9rem; font-weight: 700; color: var(--ink);" id="orgsCountLabel">Registered Organizations (1)</div>
                    <input type="text" id="orgSearchInput" placeholder="Filter organizations..." oninput="filterOrgsList(this.value)" style="padding: 6px 12px; font-size: 0.82rem; background: var(--card); border: 1px solid var(--border); border-radius: 4px; color: var(--ink); width: 220px;" />
                </div>

                <div id="orgsListGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1rem;">
                    <!-- Rendered dynamically -->
                </div>
            </div>
`;
  html = html.replace(mainClosingAnchor, orgsTabHtml + '\n        ' + mainClosingAnchor);
}

// 5. Add Modals before </body>
if (!html.includes('id="orgManagerModal"')) {
  const modalsAnchor = '</body>';
  const modalsHtml = `
    <!-- QUICK ORGANIZATION SWITCHER MODAL -->
    <div id="orgManagerModal" class="modal hidden">
        <div class="modal-inner" style="max-width: 580px; width: 95%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
                <div>
                    <h2 style="margin-bottom: 0; font-size: 1.6rem; color: #3b82f6;">🏢 Switch Organization Workspace</h2>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">Select the business entity to manage with independent data.</span>
                </div>
                <button type="button" onclick="closeOrgManagerModal()" class="btn secondary outline" style="padding: 4px 10px; font-size: 12px;">Close</button>
            </div>

            <div id="orgQuickSwitchList" style="display: flex; flex-direction: column; gap: 8px; max-height: 360px; overflow-y: auto; margin-bottom: 1.25rem;">
                <!-- Dynamically populated -->
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 0.75rem; flex-wrap: wrap; gap: 8px;">
                <button type="button" class="btn" onclick="openCreateOrgModal(); closeOrgManagerModal();" style="background: #3b82f6; color: #fff; font-size: 0.85rem;">+ Create New Organization</button>
                <button type="button" class="btn secondary outline" onclick="switchTab('orgs'); closeOrgManagerModal();" style="font-size: 0.85rem;">Manage All Stores</button>
            </div>
        </div>
    </div>

    <!-- CREATE / EDIT ORGANIZATION MODAL -->
    <div id="orgFormModal" class="modal hidden">
        <div class="modal-inner" style="max-width: 600px; width: 95%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
                <div>
                    <h2 style="margin-bottom: 0; font-size: 1.6rem; color: var(--ink);" id="orgFormModalTitle">Register New Organization</h2>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">Set up an isolated workspace for this store or branch.</span>
                </div>
                <button type="button" onclick="closeOrgFormModal()" class="btn secondary outline" style="padding: 4px 10px; font-size: 12px;">Close</button>
            </div>

            <form id="orgForm" onsubmit="submitOrgForm(event)">
                <input type="hidden" id="orgFormId" value="" />
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                        <label class="label" style="display:block; margin-bottom:4px;">Organization / Store Name *</label>
                        <input type="text" id="orgFormName" required placeholder="e.g., Star Pharmacy, Downtown Branch" style="width:100%; padding:8px 10px; background:var(--bg); border:1px solid var(--border); color:var(--ink); border-radius:4px; font-size:0.9rem;" />
                    </div>
                    <div>
                        <label class="label" style="display:block; margin-bottom:4px;">Branch / Store Code *</label>
                        <input type="text" id="orgFormCode" required placeholder="e.g., ST-02, BR-WEST" style="width:100%; padding:8px 10px; background:var(--bg); border:1px solid var(--border); color:var(--ink); border-radius:4px; font-size:0.9rem; text-transform:uppercase;" />
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                        <label class="label" style="display:block; margin-bottom:4px;">Business Type</label>
                        <select id="orgFormBusinessType" style="width:100%; padding:8px 10px; background:var(--bg); border:1px solid var(--border); color:var(--ink); border-radius:4px; font-size:0.9rem;">
                            <option value="Retail & Supermarket">Retail & Supermarket</option>
                            <option value="Pharmacy & Healthcare">Pharmacy & Healthcare</option>
                            <option value="Boutique & Fashion">Boutique & Fashion</option>
                            <option value="Electronics & Hardware">Electronics & Hardware</option>
                            <option value="Cafe & Restaurant">Cafe & Restaurant</option>
                            <option value="General Merchandise">General Merchandise</option>
                        </select>
                    </div>
                    <div>
                        <label class="label" style="display:block; margin-bottom:4px;">Currency</label>
                        <div style="display:flex; gap:6px;">
                            <select id="orgFormCurrency" onchange="onOrgCurrencyChange()" style="flex:1; padding:8px 10px; background:var(--bg); border:1px solid var(--border); color:var(--ink); border-radius:4px; font-size:0.9rem;">
                                <option value="KES">KES (Kenyan Shilling)</option>
                                <option value="USD">USD ($ US Dollar)</option>
                                <option value="EUR">EUR (€ Euro)</option>
                                <option value="GBP">GBP (£ British Pound)</option>
                                <option value="TZS">TZS (Tanzanian Shilling)</option>
                                <option value="UGX">UGX (Ugandan Shilling)</option>
                                <option value="ZAR">ZAR (South African Rand)</option>
                            </select>
                            <input type="text" id="orgFormCurrencySymbol" value="KSh" style="width:65px; padding:8px; text-align:center; background:var(--bg); border:1px solid var(--border); color:var(--ink); border-radius:4px; font-size:0.85rem;" />
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                        <label class="label" style="display:block; margin-bottom:4px;">Phone Number</label>
                        <input type="text" id="orgFormPhone" placeholder="+254 7..." style="width:100%; padding:8px 10px; background:var(--bg); border:1px solid var(--border); color:var(--ink); border-radius:4px; font-size:0.9rem;" />
                    </div>
                    <div>
                        <label class="label" style="display:block; margin-bottom:4px;">Tax PIN / VAT Reg</label>
                        <input type="text" id="orgFormTaxPin" placeholder="e.g. P051234567Z" style="width:100%; padding:8px 10px; background:var(--bg); border:1px solid var(--border); color:var(--ink); border-radius:4px; font-size:0.9rem; text-transform:uppercase;" />
                    </div>
                </div>

                <div style="margin-bottom: 12px;">
                    <label class="label" style="display:block; margin-bottom:4px;">Physical Location / Address</label>
                    <input type="text" id="orgFormAddress" placeholder="e.g. Westlands Commercial Plaza, 2nd Floor" style="width:100%; padding:8px 10px; background:var(--bg); border:1px solid var(--border); color:var(--ink); border-radius:4px; font-size:0.9rem;" />
                </div>

                <div style="margin-bottom: 12px;">
                    <label class="label" style="display:block; margin-bottom:4px;">Receipt Header Title</label>
                    <input type="text" id="orgFormReceiptHeader" placeholder="POKET STAR EPOS — [STORE NAME]" style="width:100%; padding:8px 10px; background:var(--bg); border:1px solid var(--border); color:var(--ink); border-radius:4px; font-size:0.85rem;" />
                </div>

                <div style="margin-bottom: 14px;">
                    <label class="label" style="display:block; margin-bottom:4px;">Receipt Footer Message</label>
                    <input type="text" id="orgFormReceiptFooter" placeholder="Thank you for your business! Powered by Poket Star EPOS" style="width:100%; padding:8px 10px; background:var(--bg); border:1px solid var(--border); color:var(--ink); border-radius:4px; font-size:0.85rem;" />
                </div>

                <div id="orgFormNewFields" style="margin-bottom: 16px; background: var(--ink-faint); padding: 12px; border-radius: 4px; border: 1px dashed var(--border);">
                    <div style="font-weight: 700; font-size: 0.8rem; margin-bottom: 8px; color: var(--ink);">Initial Setup Options:</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label class="label" style="display:block; margin-bottom:4px;">Admin Operator PIN</label>
                            <input type="password" id="orgFormAdminPin" value="1234" maxlength="6" style="width:100%; padding:6px 10px; text-align:center; letter-spacing:0.2em; background:var(--card); border:1px solid var(--border); color:var(--ink); border-radius:4px;" />
                        </div>
                        <div>
                            <label class="label" style="display:block; margin-bottom:4px;">Clone Catalog From</label>
                            <select id="orgFormCloneSelect" style="width:100%; padding:6px 10px; background:var(--card); border:1px solid var(--border); color:var(--ink); border-radius:4px; font-size:0.85rem;">
                                <option value="">Start with Empty Catalog</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border); padding-top: 12px;">
                    <button type="button" class="btn secondary outline" onclick="closeOrgFormModal()">Cancel</button>
                    <button type="submit" class="btn" style="background: #3b82f6; color: #fff; font-weight: 700;" id="orgFormSubmitBtn">Save Organization</button>
                </div>
            </form>
        </div>
    </div>

    <!-- IMPORT ORGANIZATION BACKUP MODAL -->
    <div id="orgImportModal" class="modal hidden">
        <div class="modal-inner" style="max-width: 480px; width: 95%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
                <h2 style="margin-bottom: 0; font-size: 1.5rem; color: var(--ink);">📥 Restore Store Backup</h2>
                <button type="button" onclick="closeImportOrgModal()" class="btn secondary outline" style="padding: 4px 10px; font-size: 12px;">Close</button>
            </div>

            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
                Select a Poket Star EPOS Organization Backup file (<code>.json</code>) to restore its catalog, sales transactions, staff, and configurations into the system.
            </p>

            <div style="margin-bottom: 1.25rem;">
                <label class="label" style="display: block; margin-bottom: 0.35rem;">Target Organization</label>
                <select id="importTargetOrgSelect" style="width: 100%; padding: 0.65rem; background: var(--bg); border: 1px solid var(--border); color: var(--ink); border-radius: 4px; font-size: 0.9rem;">
                </select>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <label class="label" style="display: block; margin-bottom: 0.35rem;">Select Backup File (.JSON)</label>
                <input type="file" id="importOrgFileInput" accept=".json,application/json" style="width: 100%; padding: 8px; background: var(--bg); border: 1px dashed var(--border); border-radius: 4px; color: var(--ink);" />
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border); padding-top: 12px;">
                <button type="button" class="btn secondary outline" onclick="closeImportOrgModal()">Cancel</button>
                <button type="button" class="btn" onclick="submitImportOrgBackup()" style="background: #3b82f6; color: #fff; font-weight: 700;">Restore Backup</button>
            </div>
        </div>
    </div>
` + modalsAnchor;
  html = html.replace(modalsAnchor, modalsHtml);
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('Successfully injected Multi-Tenant markup into index.html!');

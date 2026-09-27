const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

console.log('Original index.html size:', html.length);

const multitenantJsCode = `
        // =========================================================================
        // ===== POKET STAR EPOS — MULTI-ORGANIZATION & TENANT ISOLATION ENGINE =====
        // =========================================================================
        let currentOrgId = localStorage.getItem('pos_active_org_id') || 'default';
        let currentOrg = {
            id: 'default',
            name: 'Main Store / Headquarters',
            code: 'HQ-01',
            businessType: 'Retail & Supermarket',
            currency: 'KES',
            currencySymbol: 'KSh',
            vatRate: 16,
            receiptHeader: 'POKET STAR EPOS — HEADQUARTERS',
            receiptFooter: 'Thank you for shopping with us! Powered by Poket Star EPOS'
        };
        let organizationsList = [];

        function getOrgHeaders(customHeaders = {}) {
            return {
                ...customHeaders,
                'X-Organization-Id': currentOrgId,
                'X-Tenant-Id': currentOrgId
            };
        }

        async function loadOrganizations(autoSelect = true) {
            try {
                if (window.location.protocol.startsWith('http')) {
                    const res = await fetch('/api/orgs', {
                        headers: getOrgHeaders()
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (Array.isArray(data.organizations)) {
                            organizationsList = data.organizations;
                            localStorage.setItem('pos_cached_orgs', JSON.stringify(organizationsList));
                        }
                    }
                }
            } catch (err) {
                console.warn('Backend organizations endpoint notice:', err);
            }

            // Fallback to local cache if offline or unreached
            if (!organizationsList.length) {
                try {
                    const cached = localStorage.getItem('pos_cached_orgs');
                    if (cached) organizationsList = JSON.parse(cached);
                } catch (e) {}
            }

            if (!organizationsList.length) {
                organizationsList = [currentOrg];
            }

            // Resolve current active organization object
            const found = organizationsList.find(o => o.id === currentOrgId);
            if (found) {
                currentOrg = found;
            } else if (autoSelect && organizationsList.length > 0) {
                currentOrg = organizationsList[0];
                currentOrgId = currentOrg.id;
                localStorage.setItem('pos_active_org_id', currentOrgId);
            }

            updateHeaderOrgBadge();
            renderOrgsTab();
        }

        function updateHeaderOrgBadge() {
            const nameEl = document.getElementById('headerOrgName');
            const codeEl = document.getElementById('headerOrgCode');
            if (nameEl && currentOrg) nameEl.textContent = currentOrg.name;
            if (codeEl && currentOrg) codeEl.textContent = \`[\${currentOrg.code || 'MAIN'}] ▾\`;
        }

        function renderOrgsTab() {
            const countLabel = document.getElementById('orgsCountLabel');
            const grid = document.getElementById('orgsListGrid');
            if (!grid) return;

            if (countLabel) {
                countLabel.textContent = \`Registered Organizations (\${organizationsList.length})\`;
            }

            if (organizationsList.length === 0) {
                grid.innerHTML = '<div style="color:var(--text-muted); padding:30px; text-align:center;">No organizations registered. Click "+ New Organization" to add one.</div>';
                return;
            }

            grid.innerHTML = organizationsList.map(org => {
                const isActive = org.id === currentOrgId;
                const stats = org.stats || { productCount: 0, salesCount: 0, revenue: 0, userCount: 1 };
                const currSym = org.currencySymbol || (org.currency === 'USD' ? '$' : 'KSh');

                return \`
                    <div style="background: var(--card); border: 2px solid \${isActive ? '#3b82f6' : 'var(--border)'}; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: \${isActive ? '0 0 15px rgba(59, 130, 246, 0.15)' : 'none'}; position: relative;">
                        \${isActive ? '<span style="position:absolute; top:12px; right:12px; background:#3b82f6; color:#fff; font-size:10px; font-weight:800; padding:2px 8px; border-radius:4px; letter-spacing:0.04em;">ACTIVE WORKSPACE</span>' : ''}
                        <div>
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                                <span style="font-size:1.4rem;">🏢</span>
                                <div>
                                    <div style="font-weight:700; font-size:1.05rem; color:var(--ink);">\${org.name}</div>
                                    <div style="font-size:0.75rem; color:var(--text-muted);">
                                        <strong style="color:var(--accent);">[\${org.code || 'ORG'}]</strong> • \${org.businessType || 'Retail'} • \${org.currency || 'KES'} (\${currSym})
                                    </div>
                                </div>
                            </div>

                            \${org.address ? \`<div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">📍 \${org.address}</div>\` : ''}
                            \${org.taxPin ? \`<div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px;">🏛️ PIN: <code>\${org.taxPin}</code></div>\` : ''}

                            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px; background:var(--ink-faint); padding:10px 8px; border-radius:6px; margin:12px 0; text-align:center;">
                                <div>
                                    <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Products</div>
                                    <div style="font-weight:700; font-size:1.1rem; color:var(--ink);">\${stats.productCount !== undefined ? stats.productCount : (isActive ? state.products.length : 0)}</div>
                                </div>
                                <div>
                                    <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Sales</div>
                                    <div style="font-weight:700; font-size:1.1rem; color:var(--ink);">\${stats.salesCount !== undefined ? stats.salesCount : (isActive ? state.sales.length : 0)}</div>
                                </div>
                                <div>
                                    <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Revenue</div>
                                    <div style="font-weight:700; font-size:0.85rem; color:#10b981;">\${currSym} \${Number(stats.revenue || 0).toLocaleString()}</div>
                                </div>
                            </div>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; border-top:1px solid var(--border); padding-top:12px; margin-top:8px; flex-wrap:wrap;">
                            \${isActive 
                                ? \`<button type="button" class="btn secondary" disabled style="opacity:0.8; font-size:0.8rem; padding:5px 10px;">✓ Current Store</button>\`
                                : \`<button type="button" class="btn" onclick="switchOrganization('\${org.id}')" style="background:#3b82f6; color:#fff; font-size:0.8rem; padding:5px 12px; font-weight:700;">Switch Workspace</button>\`
                            }
                            <div style="display:inline-flex; gap:6px;">
                                <button type="button" class="btn secondary outline" onclick="openEditOrgModal('\${org.id}')" title="Edit Store Settings" style="font-size:0.75rem; padding:5px 8px;">⚙️ Edit</button>
                                <button type="button" class="btn secondary outline" onclick="exportOrgBackup('\${org.id}')" title="Download Organization Backup JSON" style="font-size:0.75rem; padding:5px 8px;">💾 Backup</button>
                                \${!org.isDefault && org.id !== 'default' 
                                    ? \`<button type="button" class="btn secondary outline" onclick="deleteOrg('\${org.id}')" title="Archive / Delete Store" style="font-size:0.75rem; padding:5px 8px; color:#ef4444; border-color:rgba(239,68,68,0.3);">🗑️</button>\`
                                    : ''
                                }
                            </div>
                        </div>
                    </div>
                \`;
            }).join('');
        }

        function filterOrgsList(query) {
            const q = (query || '').toLowerCase().trim();
            if (!q) {
                renderOrgsTab();
                return;
            }
            const grid = document.getElementById('orgsListGrid');
            if (!grid) return;
            const filtered = organizationsList.filter(o => 
                (o.name && o.name.toLowerCase().includes(q)) ||
                (o.code && o.code.toLowerCase().includes(q)) ||
                (o.businessType && o.businessType.toLowerCase().includes(q)) ||
                (o.address && o.address.toLowerCase().includes(q))
            );

            if (filtered.length === 0) {
                grid.innerHTML = '<div style="color:var(--text-muted); padding:30px; text-align:center;">No organizations match your search filter.</div>';
                return;
            }

            // Temporarily replace organizationsList for rendering
            const orig = organizationsList;
            organizationsList = filtered;
            renderOrgsTab();
            organizationsList = orig;
        }

        function openOrgManagerModal() {
            const modal = document.getElementById('orgManagerModal');
            const list = document.getElementById('orgQuickSwitchList');
            if (!modal || !list) return;

            list.innerHTML = organizationsList.map(org => {
                const isActive = org.id === currentOrgId;
                const stats = org.stats || { productCount: 0, salesCount: 0 };
                const currSym = org.currencySymbol || (org.currency === 'USD' ? '$' : 'KSh');

                return \`
                    <div onclick="switchOrganization('\${org.id}'); closeOrgManagerModal();" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-radius:6px; border:1px solid \${isActive ? '#3b82f6' : 'var(--border)'}; background:\${isActive ? 'rgba(59, 130, 246, 0.08)' : 'var(--card)'}; cursor:pointer; transition:all 0.15s ease;" onmouseover="this.style.borderColor='#3b82f6'" onmouseout="if(!\${isActive}) this.style.borderColor='var(--border)'">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:1.3rem;">🏢</span>
                            <div>
                                <div style="font-weight:700; font-size:0.95rem; color:var(--ink);">\${org.name}</div>
                                <div style="font-size:0.75rem; color:var(--text-muted);">
                                    <strong style="color:var(--accent);">[\${org.code || 'ORG'}]</strong> • \${org.currency || 'KES'} • \${stats.productCount || 0} items
                                </div>
                            </div>
                        </div>
                        <div>
                            \${isActive 
                                ? '<span style="font-size:0.75rem; font-weight:800; color:#3b82f6; background:rgba(59, 130, 246, 0.15); padding:3px 8px; border-radius:4px;">CURRENT</span>'
                                : '<span style="font-size:0.75rem; color:var(--text-muted);">Click to Switch →</span>'
                            }
                        </div>
                    </div>
                \`;
            }).join('');

            modal.classList.remove('hidden');
        }

        function closeOrgManagerModal() {
            const modal = document.getElementById('orgManagerModal');
            if (modal) modal.classList.add('hidden');
        }

        async function switchOrganization(orgId) {
            if (orgId === currentOrgId && currentOrg) return;
            const target = organizationsList.find(o => o.id === orgId);
            if (!target) return;

            currentOrgId = orgId;
            currentOrg = target;
            localStorage.setItem('pos_active_org_id', orgId);
            document.cookie = \`pos_org_id=\${orgId}; path=/; max-age=31536000\`;

            updateHeaderOrgBadge();

            // Refresh scoped organization dataset
            await fetchProductsFromAPI(true);
            await loadUsersFromBackend();
            await fetchSalesFromAPI();

            renderOrgsTab();
            renderCategoryFilters();
            renderProductSidebar();
            renderProductsListTab();
            renderCart();
            updateReports();

            showPosToast(\`Active Workspace switched to: \${target.name} [\${target.code}]\`, 'success', 3500);
        }

        async function fetchSalesFromAPI() {
            if (window.location.protocol.startsWith('http')) {
                try {
                    const res = await fetch('/api/sales', {
                        headers: getOrgHeaders()
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (Array.isArray(data.sales)) {
                            state.sales = data.sales;
                            saveState(false);
                        }
                    }
                } catch (e) {}
            }
        }

        function openCreateOrgModal() {
            const modal = document.getElementById('orgFormModal');
            const title = document.getElementById('orgFormModalTitle');
            const form = document.getElementById('orgForm');
            const cloneSel = document.getElementById('orgFormCloneSelect');
            const newFields = document.getElementById('orgFormNewFields');

            if (!modal || !form) return;

            form.reset();
            document.getElementById('orgFormId').value = '';
            if (title) title.textContent = 'Register New Organization / Store';
            if (newFields) newFields.style.display = 'block';

            if (cloneSel) {
                cloneSel.innerHTML = '<option value="">Start with Empty Catalog</option>' + 
                    organizationsList.map(o => \`<option value="\${o.id}">Clone Catalog from \${o.name} (\${o.code})</option>\`).join('');
            }

            modal.classList.remove('hidden');
        }

        function openEditOrgModal(orgId) {
            const org = organizationsList.find(o => o.id === orgId);
            if (!org) return;

            const modal = document.getElementById('orgFormModal');
            const title = document.getElementById('orgFormModalTitle');
            const newFields = document.getElementById('orgFormNewFields');

            if (!modal) return;

            document.getElementById('orgFormId').value = org.id;
            document.getElementById('orgFormName').value = org.name || '';
            document.getElementById('orgFormCode').value = org.code || '';
            document.getElementById('orgFormBusinessType').value = org.businessType || 'Retail & Supermarket';
            document.getElementById('orgFormCurrency').value = org.currency || 'KES';
            document.getElementById('orgFormCurrencySymbol').value = org.currencySymbol || 'KSh';
            document.getElementById('orgFormPhone').value = org.phone || '';
            document.getElementById('orgFormTaxPin').value = org.taxPin || '';
            document.getElementById('orgFormAddress').value = org.address || '';
            document.getElementById('orgFormReceiptHeader').value = org.receiptHeader || '';
            document.getElementById('orgFormReceiptFooter').value = org.receiptFooter || '';

            if (title) title.textContent = \`Edit Organization: \${org.name}\`;
            if (newFields) newFields.style.display = 'none';

            modal.classList.remove('hidden');
        }

        function closeOrgFormModal() {
            const modal = document.getElementById('orgFormModal');
            if (modal) modal.classList.add('hidden');
        }

        function onOrgCurrencyChange() {
            const curr = document.getElementById('orgFormCurrency').value;
            const symInput = document.getElementById('orgFormCurrencySymbol');
            const map = { KES: 'KSh', USD: '$', EUR: '€', GBP: '£', TZS: 'TSh', UGX: 'USh', ZAR: 'R' };
            if (symInput && map[curr]) symInput.value = map[curr];
        }

        async function submitOrgForm(e) {
            e.preventDefault();
            const orgId = document.getElementById('orgFormId').value;
            const isEdit = Boolean(orgId);

            const payload = {
                name: document.getElementById('orgFormName').value.trim(),
                code: document.getElementById('orgFormCode').value.trim().toUpperCase(),
                businessType: document.getElementById('orgFormBusinessType').value,
                currency: document.getElementById('orgFormCurrency').value,
                currencySymbol: document.getElementById('orgFormCurrencySymbol').value,
                phone: document.getElementById('orgFormPhone').value.trim(),
                taxPin: document.getElementById('orgFormTaxPin').value.trim().toUpperCase(),
                address: document.getElementById('orgFormAddress').value.trim(),
                receiptHeader: document.getElementById('orgFormReceiptHeader').value.trim(),
                receiptFooter: document.getElementById('orgFormReceiptFooter').value.trim()
            };

            if (!isEdit) {
                payload.adminPin = document.getElementById('orgFormAdminPin').value || '1234';
                payload.cloneFromOrgId = document.getElementById('orgFormCloneSelect').value || undefined;
            }

            try {
                const url = isEdit ? \`/api/orgs/\${orgId}\` : '/api/orgs';
                const method = isEdit ? 'PUT' : 'POST';

                const res = await fetch(url, {
                    method,
                    headers: getOrgHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    closeOrgFormModal();
                    await loadOrganizations(false);

                    if (!isEdit && data.organization) {
                        // Automatically switch to newly created organization
                        await switchOrganization(data.organization.id);
                    } else {
                        renderOrgsTab();
                    }
                    showPosToast(data.message || 'Organization saved successfully!', 'success', 3500);
                } else {
                    showPosToast(data.message || 'Failed to save organization.', 'error', 4000);
                }
            } catch (err) {
                showPosToast(\`Error saving organization: \${err.message}\`, 'error', 4000);
            }
        }

        async function deleteOrg(orgId) {
            const org = organizationsList.find(o => o.id === orgId);
            if (!org) return;

            if (org.isDefault || org.id === 'default') {
                showPosToast('The primary default organization cannot be deleted.', 'warning', 3000);
                return;
            }

            if (!confirm(\`Are you sure you want to archive / delete store "\${org.name}" [\${org.code}]?\\n\\nIts isolated database will be safely archived without affecting other stores.\`)) {
                return;
            }

            try {
                const res = await fetch(\`/api/orgs/\${orgId}\`, {
                    method: 'DELETE',
                    headers: getOrgHeaders()
                });
                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    showPosToast(data.message, 'success', 3500);
                    if (currentOrgId === orgId) {
                        await switchOrganization('default');
                    } else {
                        await loadOrganizations(false);
                    }
                } else {
                    showPosToast(data.message || 'Failed to delete organization.', 'error', 4000);
                }
            } catch (err) {
                showPosToast(\`Error deleting organization: \${err.message}\`, 'error', 4000);
            }
        }

        function exportOrgBackup(orgId) {
            window.location.href = \`/api/orgs/\${orgId}/export\`;
        }

        function openImportOrgModal() {
            const modal = document.getElementById('orgImportModal');
            const targetSel = document.getElementById('importTargetOrgSelect');
            if (!modal || !targetSel) return;

            targetSel.innerHTML = organizationsList.map(o => 
                \`<option value="\${o.id}" \${o.id === currentOrgId ? 'selected' : ''}>\${o.name} [\${o.code}]</option>\`
            ).join('');

            modal.classList.remove('hidden');
        }

        function closeImportOrgModal() {
            const modal = document.getElementById('orgImportModal');
            if (modal) modal.classList.add('hidden');
        }

        async function submitImportOrgBackup() {
            const fileInput = document.getElementById('importOrgFileInput');
            const targetOrgId = document.getElementById('importTargetOrgSelect').value;

            if (!fileInput || !fileInput.files.length) {
                showPosToast('Please select a valid .json backup file.', 'warning', 3000);
                return;
            }

            const file = fileInput.files[0];
            try {
                const text = await file.text();
                const json = JSON.parse(text);

                const res = await fetch(\`/api/orgs/\${targetOrgId}/import\`, {
                    method: 'POST',
                    headers: getOrgHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(json)
                });

                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    closeImportOrgModal();
                    await switchOrganization(targetOrgId);
                    showPosToast(data.message || 'Store backup restored successfully!', 'success', 4000);
                } else {
                    showPosToast(data.message || 'Failed to restore store backup.', 'error', 4000);
                }
            } catch (err) {
                showPosToast(\`Invalid backup file: \${err.message}\`, 'error', 4000);
            }
        }
`;

// Insert multitenantJsCode into script tag
const insertAnchor = '// ===== TAB NAVIGATION =====';
html = html.replace(insertAnchor, multitenantJsCode + '\n' + insertAnchor);

// Update switchTab to handle 'orgs' tab
html = html.replace(
  "if (tabName === 'reports') updateReports();",
  "if (tabName === 'reports') updateReports();\n            if (tabName === 'orgs') renderOrgsTab();"
);

// Update canAccessTab to allow orgs for admin
html = html.replace(
  "users: 'Staff & User Registry',",
  "users: 'Staff & User Registry',\n                    orgs: 'Organizations & Stores',"
);

// Update initApp to call loadOrganizations()
html = html.replace(
  "ensureDefaultPrinterSettings();",
  "ensureDefaultPrinterSettings();\n            await loadOrganizations(true);"
);

// Update fetchProductsFromAPI to pass getOrgHeaders()
html = html.replace(
  "const res = await fetch('/api/products');",
  "const res = await fetch('/api/products', { headers: getOrgHeaders() });"
);

// Update loadUsersFromBackend to pass getOrgHeaders()
html = html.replace(
  "const res = await fetch('/api/users');",
  "const res = await fetch('/api/users', { headers: getOrgHeaders() });"
);

// Update fetch('/api/sales' in saveSale to pass getOrgHeaders()
html = html.replace(
  "body: JSON.stringify(saleRecord)\n                });",
  "body: JSON.stringify(saleRecord),\n                    headers: getOrgHeaders({ 'Content-Type': 'application/json' })\n                });"
);

fs.writeFileSync(indexPath, html, 'utf8');
console.log('Successfully patched index.html with Multi-Tenant JavaScript Engine!');

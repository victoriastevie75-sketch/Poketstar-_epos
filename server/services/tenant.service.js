const fs = require('fs');
const path = require('path');

/**
 * Poket Star EPOS — Multi-Organization & Multi-Tenant Isolation Engine
 * 
 * Provides complete data isolation per organization:
 * - Products & Inventory Catalog
 * - Sales Ledger & Transactions
 * - User Accounts & Staff Permissions
 * - Store Settings, Taxes, & Receipt Branding
 * 
 * Guarantees zero data loss across software updates by partitioning
 * state into persistent per-organization workspaces.
 */

const DATA_DIR = path.join(process.cwd(), 'data');
const ORGS_DIR = path.join(DATA_DIR, 'orgs');
const ORGS_REGISTRY_PATH = path.join(DATA_DIR, 'organizations.json');

// Ensure base storage directories exist
function ensureBaseDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ORGS_DIR)) {
    fs.mkdirSync(ORGS_DIR, { recursive: true });
  }
}

// Ensure an organization's isolated workspace directory exists
function ensureOrgDir(orgId) {
  ensureBaseDirs();
  const safeId = sanitizeOrgId(orgId);
  const orgDirPath = path.join(ORGS_DIR, safeId);
  if (!fs.existsSync(orgDirPath)) {
    fs.mkdirSync(orgDirPath, { recursive: true });
  }
  const receiptsDir = path.join(orgDirPath, 'receipts');
  if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
  }
  return orgDirPath;
}

// Sanitize Organization ID
function sanitizeOrgId(orgId) {
  if (!orgId || typeof orgId !== 'string') return 'default';
  const clean = orgId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
  return clean || 'default';
}

// Default initial organizations setup with automatic migration from legacy root files
function initializeRegistry() {
  ensureBaseDirs();
  if (fs.existsSync(ORGS_REGISTRY_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(ORGS_REGISTRY_PATH, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (e) {
      console.warn('[Tenant] Error parsing organizations.json, initializing fallback:', e.message);
    }
  }

  // Initial default organization
  const defaultOrg = {
    id: 'default',
    name: 'Main Store / Headquarters',
    code: 'HQ-01',
    businessType: 'Retail & Supermarket',
    currency: 'KES',
    currencySymbol: 'KSh',
    phone: '+254 700 000 000',
    email: 'store@poketstar.com',
    address: 'Central Business District, Main Avenue',
    taxPin: 'P051234567Z',
    vatRate: 16,
    receiptHeader: 'POKET STAR EPOS — HEADQUARTERS',
    receiptFooter: 'Thank you for shopping with us! Powered by Poket Star EPOS',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const initialList = [defaultOrg];
  fs.writeFileSync(ORGS_REGISTRY_PATH, JSON.stringify(initialList, null, 2), 'utf8');

  // Migrate any existing root products.json, sales.json, users.json into default org dir
  const defaultDir = ensureOrgDir('default');
  
  const rootProducts = path.join(process.cwd(), 'products.json');
  const orgProducts = path.join(defaultDir, 'products.json');
  if (fs.existsSync(rootProducts) && !fs.existsSync(orgProducts)) {
    try {
      fs.copyFileSync(rootProducts, orgProducts);
    } catch (e) {}
  } else if (!fs.existsSync(orgProducts)) {
    fs.writeFileSync(orgProducts, '[]', 'utf8');
  }

  const rootUsers = path.join(process.cwd(), 'users.json');
  const orgUsers = path.join(defaultDir, 'users.json');
  if (fs.existsSync(rootUsers) && !fs.existsSync(orgUsers)) {
    try {
      fs.copyFileSync(rootUsers, orgUsers);
    } catch (e) {}
  }

  const rootSales = path.join(process.cwd(), 'sales.json');
  const orgSales = path.join(defaultDir, 'sales.json');
  if (fs.existsSync(rootSales) && !fs.existsSync(orgSales)) {
    try {
      fs.copyFileSync(rootSales, orgSales);
    } catch (e) {}
  } else if (!fs.existsSync(orgSales)) {
    fs.writeFileSync(orgSales, '[]', 'utf8');
  }

  return initialList;
}

// Get all registered organizations
function getOrganizations() {
  const orgs = initializeRegistry();
  return orgs.map(org => {
    const orgDir = ensureOrgDir(org.id);
    let productCount = 0;
    let salesCount = 0;
    let revenue = 0;
    let userCount = 0;

    try {
      const pPath = path.join(orgDir, 'products.json');
      if (fs.existsSync(pPath)) {
        const pData = JSON.parse(fs.readFileSync(pPath, 'utf8'));
        if (Array.isArray(pData)) productCount = pData.length;
      }
    } catch (e) {}

    try {
      const sPath = path.join(orgDir, 'sales.json');
      if (fs.existsSync(sPath)) {
        const sData = JSON.parse(fs.readFileSync(sPath, 'utf8'));
        if (Array.isArray(sData)) {
          salesCount = sData.length;
          revenue = sData.reduce((acc, s) => acc + (Number(s.total) || Number(s.amount) || 0), 0);
        }
      }
    } catch (e) {}

    try {
      const uPath = path.join(orgDir, 'users.json');
      if (fs.existsSync(uPath)) {
        const uData = JSON.parse(fs.readFileSync(uPath, 'utf8'));
        if (Array.isArray(uData)) userCount = uData.length;
      }
    } catch (e) {}

    return {
      ...org,
      stats: {
        productCount,
        salesCount,
        revenue: Math.round(revenue * 100) / 100,
        userCount: userCount || 1
      }
    };
  });
}

// Get single organization by ID
function getOrganization(orgId) {
  const orgs = getOrganizations();
  const safeId = sanitizeOrgId(orgId);
  const found = orgs.find(o => o.id === safeId);
  return found || orgs.find(o => o.id === 'default') || orgs[0];
}

// Create a new organization
function createOrganization(payload) {
  const orgs = initializeRegistry();
  const rawName = (payload.name || 'New Organization').trim();
  let baseId = (payload.id || payload.code || rawName).toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
  if (!baseId || baseId === 'default') {
    baseId = 'org-' + Date.now().toString(36);
  }

  // Ensure unique ID
  let uniqueId = baseId;
  let counter = 1;
  while (orgs.some(o => o.id === uniqueId)) {
    uniqueId = `${baseId}-${counter++}`;
  }

  const newOrg = {
    id: uniqueId,
    name: rawName,
    code: (payload.code || `ORG-${orgs.length + 1}`).toUpperCase().trim(),
    businessType: payload.businessType || 'Retail Store',
    currency: payload.currency || 'KES',
    currencySymbol: payload.currencySymbol || (payload.currency === 'USD' ? '$' : 'KSh'),
    phone: payload.phone || '',
    email: payload.email || '',
    address: payload.address || '',
    taxPin: payload.taxPin || '',
    vatRate: payload.vatRate !== undefined ? Number(payload.vatRate) : 16,
    receiptHeader: payload.receiptHeader || `POKET STAR EPOS — ${rawName.toUpperCase()}`,
    receiptFooter: payload.receiptFooter || 'Thank you for your business! Powered by Poket Star EPOS',
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  orgs.push(newOrg);
  fs.writeFileSync(ORGS_REGISTRY_PATH, JSON.stringify(orgs, null, 2), 'utf8');

  // Initialize isolated data directory
  const newOrgDir = ensureOrgDir(uniqueId);

  // If user requested to clone products from an existing org
  if (payload.cloneFromOrgId) {
    const srcProducts = getOrgProducts(payload.cloneFromOrgId);
    fs.writeFileSync(path.join(newOrgDir, 'products.json'), JSON.stringify(srcProducts, null, 2), 'utf8');
  } else if (Array.isArray(payload.initialProducts)) {
    fs.writeFileSync(path.join(newOrgDir, 'products.json'), JSON.stringify(payload.initialProducts, null, 2), 'utf8');
  } else {
    fs.writeFileSync(path.join(newOrgDir, 'products.json'), '[]', 'utf8');
  }

  // Initialize empty sales
  fs.writeFileSync(path.join(newOrgDir, 'sales.json'), '[]', 'utf8');

  // Initialize staff
  const defaultAdmin = [
    {
      id: `USR-${uniqueId}-01`,
      username: 'admin',
      name: `${rawName} Administrator`,
      role: 'admin',
      pin: payload.adminPin || '1234',
      tillId: 'Till-01',
      status: 'active',
      phone: payload.phone || '',
      email: payload.email || `admin@${uniqueId}.poketstar.internal`,
      permissions: ['sales', 'discounts', 'refunds', 'inventory', 'reports', 'users', 'orgs'],
      createdAt: new Date().toISOString()
    }
  ];
  fs.writeFileSync(path.join(newOrgDir, 'users.json'), JSON.stringify(defaultAdmin, null, 2), 'utf8');

  // Initialize settings
  const defaultSettings = {
    taxRate: newOrg.vatRate,
    currency: newOrg.currency,
    receiptHeader: newOrg.receiptHeader,
    receiptFooter: newOrg.receiptFooter,
    autoPrint: false,
    soundEnabled: true,
    theme: 'emerald'
  };
  fs.writeFileSync(path.join(newOrgDir, 'settings.json'), JSON.stringify(defaultSettings, null, 2), 'utf8');

  return newOrg;
}

// Update organization details
function updateOrganization(orgId, updatePayload) {
  const orgs = initializeRegistry();
  const safeId = sanitizeOrgId(orgId);
  const idx = orgs.findIndex(o => o.id === safeId);

  if (idx === -1) {
    throw new Error(`Organization '${safeId}' not found`);
  }

  const existing = orgs[idx];
  const updated = {
    ...existing,
    name: updatePayload.name ? updatePayload.name.trim() : existing.name,
    code: updatePayload.code ? updatePayload.code.toUpperCase().trim() : existing.code,
    businessType: updatePayload.businessType || existing.businessType,
    currency: updatePayload.currency || existing.currency,
    currencySymbol: updatePayload.currencySymbol || existing.currencySymbol,
    phone: updatePayload.phone !== undefined ? updatePayload.phone : existing.phone,
    email: updatePayload.email !== undefined ? updatePayload.email : existing.email,
    address: updatePayload.address !== undefined ? updatePayload.address : existing.address,
    taxPin: updatePayload.taxPin !== undefined ? updatePayload.taxPin : existing.taxPin,
    vatRate: updatePayload.vatRate !== undefined ? Number(updatePayload.vatRate) : existing.vatRate,
    receiptHeader: updatePayload.receiptHeader || existing.receiptHeader,
    receiptFooter: updatePayload.receiptFooter || existing.receiptFooter,
    updatedAt: new Date().toISOString()
  };

  orgs[idx] = updated;
  fs.writeFileSync(ORGS_REGISTRY_PATH, JSON.stringify(orgs, null, 2), 'utf8');
  return updated;
}

// Delete an organization (except default)
function deleteOrganization(orgId) {
  const safeId = sanitizeOrgId(orgId);
  if (safeId === 'default') {
    throw new Error('The primary default organization cannot be deleted.');
  }

  const orgs = initializeRegistry();
  const filtered = orgs.filter(o => o.id !== safeId);
  if (filtered.length === orgs.length) {
    throw new Error(`Organization '${safeId}' not found`);
  }

  fs.writeFileSync(ORGS_REGISTRY_PATH, JSON.stringify(filtered, null, 2), 'utf8');

  // Archive organization folder instead of unrecoverable delete
  const orgDir = path.join(ORGS_DIR, safeId);
  const archiveDir = path.join(DATA_DIR, 'archived_orgs');
  if (fs.existsSync(orgDir)) {
    try {
      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
      const dest = path.join(archiveDir, `${safeId}_${Date.now()}`);
      fs.renameSync(orgDir, dest);
    } catch (e) {
      console.warn(`[Tenant] Archive org notice: ${e.message}`);
    }
  }

  return { success: true, message: `Organization '${safeId}' archived successfully.` };
}

// Scoped Products Access
function getOrgProducts(orgId) {
  const safeId = sanitizeOrgId(orgId);
  const orgDir = ensureOrgDir(safeId);
  const filePath = path.join(orgDir, 'products.json');

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    } catch (e) {
      console.error(`[Tenant] Error reading products for org ${safeId}:`, e.message);
    }
  }

  // Fallback for default org to root products.json
  if (safeId === 'default') {
    const rootPath = path.join(process.cwd(), 'products.json');
    if (fs.existsSync(rootPath)) {
      try {
        const rootData = JSON.parse(fs.readFileSync(rootPath, 'utf8'));
        if (Array.isArray(rootData)) return rootData;
      } catch (e) {}
    }
  }

  return [];
}

function saveOrgProducts(orgId, products) {
  const safeId = sanitizeOrgId(orgId);
  const orgDir = ensureOrgDir(safeId);
  const filePath = path.join(orgDir, 'products.json');

  try {
    fs.writeFileSync(filePath, JSON.stringify(products, null, 2), 'utf8');

    // If default org, keep root products.json & web/products.json synchronized
    if (safeId === 'default') {
      const rootPath = path.join(process.cwd(), 'products.json');
      fs.writeFileSync(rootPath, JSON.stringify(products, null, 2), 'utf8');
      const webPath = path.join(process.cwd(), 'web', 'products.json');
      if (fs.existsSync(path.dirname(webPath))) {
        fs.writeFileSync(webPath, JSON.stringify(products, null, 2), 'utf8');
      }
      try {
        const { syncSystemToExeFiles } = require('../../scripts/sync-exe');
        syncSystemToExeFiles({ products }, { updateZip: false, silent: true });
      } catch (e) {}
    }
    return true;
  } catch (err) {
    console.error(`[Tenant] Error saving products for org ${safeId}:`, err.message);
    return false;
  }
}

// Scoped Sales Access
function getOrgSales(orgId) {
  const safeId = sanitizeOrgId(orgId);
  const orgDir = ensureOrgDir(safeId);
  const filePath = path.join(orgDir, 'sales.json');

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    } catch (e) {
      console.error(`[Tenant] Error reading sales for org ${safeId}:`, e.message);
    }
  }

  if (safeId === 'default') {
    const rootPath = path.join(process.cwd(), 'sales.json');
    if (fs.existsSync(rootPath)) {
      try {
        const rootData = JSON.parse(fs.readFileSync(rootPath, 'utf8'));
        if (Array.isArray(rootData)) return rootData;
      } catch (e) {}
    }
  }

  return [];
}

function saveOrgSales(orgId, sales) {
  const safeId = sanitizeOrgId(orgId);
  const orgDir = ensureOrgDir(safeId);
  const filePath = path.join(orgDir, 'sales.json');

  try {
    fs.writeFileSync(filePath, JSON.stringify(sales, null, 2), 'utf8');
    if (safeId === 'default') {
      const rootPath = path.join(process.cwd(), 'sales.json');
      fs.writeFileSync(rootPath, JSON.stringify(sales, null, 2), 'utf8');
    }
    return true;
  } catch (err) {
    console.error(`[Tenant] Error saving sales for org ${safeId}:`, err.message);
    return false;
  }
}

// Scoped Users Access
function getOrgUsers(orgId) {
  const safeId = sanitizeOrgId(orgId);
  const orgDir = ensureOrgDir(safeId);
  const filePath = path.join(orgDir, 'users.json');

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const list = JSON.parse(data);
      if (Array.isArray(list) && list.length > 0) return list;
    } catch (e) {
      console.error(`[Tenant] Error reading users for org ${safeId}:`, e.message);
    }
  }

  // Default initial admin for org
  const org = getOrganization(safeId);
  return [
    {
      id: `USR-${safeId}-01`,
      username: 'admin',
      name: `${org.name} Administrator`,
      role: 'admin',
      pin: '1234',
      tillId: 'Till-01',
      status: 'active',
      phone: org.phone || '',
      email: org.email || `admin@${safeId}.poketstar.internal`,
      permissions: ['sales', 'discounts', 'refunds', 'inventory', 'reports', 'users', 'orgs'],
      createdAt: new Date().toISOString()
    }
  ];
}

function saveOrgUsers(orgId, users) {
  const safeId = sanitizeOrgId(orgId);
  const orgDir = ensureOrgDir(safeId);
  const filePath = path.join(orgDir, 'users.json');

  try {
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');
    if (safeId === 'default') {
      const rootPath = path.join(process.cwd(), 'users.json');
      fs.writeFileSync(rootPath, JSON.stringify(users, null, 2), 'utf8');
    }
    return true;
  } catch (err) {
    console.error(`[Tenant] Error saving users for org ${safeId}:`, err.message);
    return false;
  }
}

// Scoped Settings Access
function getOrgSettings(orgId) {
  const safeId = sanitizeOrgId(orgId);
  const orgDir = ensureOrgDir(safeId);
  const filePath = path.join(orgDir, 'settings.json');
  const org = getOrganization(safeId);

  const defaults = {
    taxRate: org.vatRate || 16,
    currency: org.currency || 'KES',
    currencySymbol: org.currencySymbol || 'KSh',
    receiptHeader: org.receiptHeader || `POKET STAR EPOS — ${org.name.toUpperCase()}`,
    receiptFooter: org.receiptFooter || 'Thank you for your business! Powered by Poket Star EPOS',
    autoPrint: false,
    soundEnabled: true,
    theme: 'emerald'
  };

  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return { ...defaults, ...data };
    } catch (e) {}
  }

  return defaults;
}

function saveOrgSettings(orgId, settings) {
  const safeId = sanitizeOrgId(orgId);
  const orgDir = ensureOrgDir(safeId);
  const filePath = path.join(orgDir, 'settings.json');

  try {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`[Tenant] Error saving settings for org ${safeId}:`, err.message);
    return false;
  }
}

// Export Full Organization Backup (.JSON)
function exportOrgBackup(orgId) {
  const safeId = sanitizeOrgId(orgId);
  const org = getOrganization(safeId);
  const products = getOrgProducts(safeId);
  const sales = getOrgSales(safeId);
  const users = getOrgUsers(safeId);
  const settings = getOrgSettings(safeId);

  return {
    exportVersion: '1.0',
    system: 'Poket Star EPOS',
    exportedAt: new Date().toISOString(),
    organization: org,
    data: {
      products,
      sales,
      users,
      settings
    }
  };
}

// Import Organization Backup
function importOrgBackup(orgId, backupPayload) {
  const safeId = sanitizeOrgId(orgId);
  if (!backupPayload || !backupPayload.data) {
    throw new Error('Invalid backup file format.');
  }

  const { products, sales, users, settings } = backupPayload.data;
  if (Array.isArray(products)) saveOrgProducts(safeId, products);
  if (Array.isArray(sales)) saveOrgSales(safeId, sales);
  if (Array.isArray(users)) saveOrgUsers(safeId, users);
  if (settings && typeof settings === 'object') saveOrgSettings(safeId, settings);

  if (backupPayload.organization && backupPayload.organization.name) {
    updateOrganization(safeId, {
      name: backupPayload.organization.name,
      code: backupPayload.organization.code,
      currency: backupPayload.organization.currency,
      taxPin: backupPayload.organization.taxPin,
      phone: backupPayload.organization.phone,
      address: backupPayload.organization.address,
      receiptHeader: backupPayload.organization.receiptHeader,
      receiptFooter: backupPayload.organization.receiptFooter
    });
  }

  return { success: true, message: `Backup restored successfully into organization '${safeId}'.` };
}

module.exports = {
  sanitizeOrgId,
  getOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOrgProducts,
  saveOrgProducts,
  getOrgSales,
  saveOrgSales,
  getOrgUsers,
  saveOrgUsers,
  getOrgSettings,
  saveOrgSettings,
  exportOrgBackup,
  importOrgBackup
};
